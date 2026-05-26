import 'dotenv/config'

// Thin client for Cloudflare's GraphQL Analytics API. Used to import historical
// traffic for the period before our own per-request telemetry existed.
//
// Datasets:
//   httpRequests1hGroups      — hourly rollups, NOT sampled, ~30-day retention.
//                               Used for requests / status / country (the headline
//                               numbers we want accurate and reaching back weeks).
//   httpRequestsAdaptiveGroups — richer per-path detail, but SAMPLED (multiply by
//                               sampleInterval) and short retention (a few days).
//                               Used only for top-path breakdown.

const ENDPOINT = 'https://api.cloudflare.com/client/v4/graphql'

function credentials() {
  const token = process.env.CLOUDFLARE_API_TOKEN
  const zone = process.env.CLOUDFLARE_ZONE_ID
  if (!token || !zone) {
    throw new Error(
      'Cloudflare backfill needs CLOUDFLARE_API_TOKEN and CLOUDFLARE_ZONE_ID. ' +
      'Create a token with Zone → Analytics → Read for k-popdle.com, and copy the Zone ID from the zone overview.'
    )
  }
  return { token, zone }
}

async function query(graphql, variables) {
  const { token } = credentials()
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ query: graphql, variables }),
  })
  if (!res.ok) throw new Error(`Cloudflare API HTTP ${res.status}: ${await res.text()}`)
  const json = await res.json()
  if (json.errors?.length) throw new Error('Cloudflare GraphQL error: ' + JSON.stringify(json.errors))
  return json.data?.viewer?.zones?.[0] ?? {}
}

const toUnix = (iso) => Math.floor(new Date(iso).getTime() / 1000)

// Hourly requests by status + by country (one query, non-sampled).
export async function fetchTrafficByHour(since, until) {
  const { zone } = credentials()
  const gql = `
    query($zone:String!,$since:Time!,$until:Time!){
      viewer{zones(filter:{zoneTag:$zone}){
        httpRequests1hGroups(limit:5000,filter:{datetime_geq:$since,datetime_leq:$until},orderBy:[datetime_ASC]){
          dimensions{ datetime }
          sum{
            responseStatusMap{ edgeResponseStatus requests }
            countryMap{ clientCountryName requests }
          }
        }
      }}}`
  const z = await query(gql, { zone, since, until })
  const groups = z.httpRequests1hGroups || []

  const status = []
  const geo = []
  for (const g of groups) {
    const bucketHour = toUnix(g.dimensions.datetime)
    for (const s of g.sum?.responseStatusMap || []) {
      status.push({ bucketHour, status: s.edgeResponseStatus, count: s.requests })
    }
    for (const c of g.sum?.countryMap || []) {
      geo.push({ bucketHour, country: (c.clientCountryName || '??').toUpperCase().slice(0, 2), count: c.requests })
    }
  }
  return { status, geo }
}

// Top paths by day + status (sampled; short retention).
export async function fetchPathStatus(since, until) {
  const { zone } = credentials()
  const gql = `
    query($zone:String!,$since:Time!,$until:Time!){
      viewer{zones(filter:{zoneTag:$zone}){
        httpRequestsAdaptiveGroups(limit:5000,filter:{datetime_geq:$since,datetime_leq:$until},orderBy:[count_DESC]){
          count avg{sampleInterval} dimensions{ date clientRequestPath edgeResponseStatus }
        }
      }}}`
  const z = await query(gql, { zone, since, until })
  return (z.httpRequestsAdaptiveGroups || [])
    .filter(g => g.dimensions.clientRequestPath)
    .map(g => ({
      day: g.dimensions.date,
      path: g.dimensions.clientRequestPath.slice(0, 200),
      status: g.dimensions.edgeResponseStatus,
      count: Math.round(g.count * (g.avg?.sampleInterval || 1)),
    }))
}
