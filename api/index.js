import serverless from 'serverless-http'
import app from '../server/index.js'

export default serverless(app)
