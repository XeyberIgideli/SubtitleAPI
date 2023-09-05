import express from 'express'
import scraper from './routes/service.js'

const port = 4500

const app = express()


app.get('api', scraper)

app.listen(port, (err) => {
    if(err) {
        console.log('Some problem in server', err)
    }
})