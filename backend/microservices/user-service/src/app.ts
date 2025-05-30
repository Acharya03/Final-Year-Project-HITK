import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { healthRoutes } from './routes/healthRoutes'
import { authRoutes } from './routes/authRoutes'
import { errorMiddleware } from './middleware/errorMiddleware'
import { metricsMiddleware, getMetrics } from './middleware/metricsMiddleware'

const app = express()

// Middleware
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(cors())
app.use(helmet())
app.use(metricsMiddleware)


// Routes
app.use('/api/auth', authRoutes)
app.use('/api/health', healthRoutes)
app.get('/metrics', getMetrics)

// Error Handler
app.use(errorMiddleware)

const PORT = 3000

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})

export default app;