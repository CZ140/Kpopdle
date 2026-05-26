import { useEffect } from 'react'

const SITE = 'https://k-popdle.com'

function setMetaByName(name, content) {
  if (!content) return
  let el = document.head.querySelector(`meta[name="${name}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute('name', name)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

function setMetaByProperty(property, content) {
  if (!content) return
  let el = document.head.querySelector(`meta[property="${property}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute('property', property)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

function setCanonical(href) {
  if (!href) return
  let el = document.head.querySelector('link[rel="canonical"]')
  if (!el) {
    el = document.createElement('link')
    el.setAttribute('rel', 'canonical')
    document.head.appendChild(el)
  }
  el.setAttribute('href', href)
}

/**
 * Keeps per-route SEO/meta tags in sync as the user navigates the SPA.
 * Each route owns its title, description, canonical URL, and OG/Twitter tags
 * so individual pages (e.g. /twice) can be indexed and shared on their own.
 *
 * @param {{ title?: string, description?: string, path?: string }} meta
 *   path is the route path (e.g. '/twice'); defaults to the document title only.
 */
export function useDocumentMeta({ title, description, path } = {}) {
  useEffect(() => {
    if (title) document.title = title

    if (description) {
      setMetaByName('description', description)
      setMetaByProperty('og:description', description)
      setMetaByName('twitter:description', description)
    }
    if (title) {
      setMetaByProperty('og:title', title)
      setMetaByName('twitter:title', title)
    }

    const url = path ? `${SITE}${path}` : SITE
    setCanonical(url)
    setMetaByProperty('og:url', url)
  }, [title, description, path])
}
