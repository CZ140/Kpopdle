import corsMiddleware from 'cors'

const cors = corsMiddleware({
  origin: process.env.NODE_ENV === 'production'
    ? false // Same-origin in production
    : 'http://localhost:3000',
  methods: ['GET', 'POST'],
})

export default cors
