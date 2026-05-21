import corsMiddleware from 'cors'

const cors = corsMiddleware({
  origin: process.env.NODE_ENV === 'production'
    ? false
    : 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'DELETE'],
})

export default cors
