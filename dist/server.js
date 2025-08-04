import bodyParser from 'body-parser';
import express from 'express';
import api from './api.js';
import apiV2 from './apiV2.js';
const app = express();
const port = process.env.PORT || 5000;
// Middleware to enable CORS
app.use((req, res, next)=>{
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
});
// Body parser middleware
app.use(bodyParser.urlencoded({
    extended: true
}));
app.use(bodyParser.json());
// Get API route
app.get('/api', api);
// get API v2 route
app.get('/api/v2', apiV2);
// healthz
app.get('/healthz', (req, res)=>{
    res.status(200).json('OK');
});
// Error handler
app.use((err, req, res, next)=>{
    console.error(err.stack);
    res.status(400).send(err.message);
});
// Start the server
app.listen(port, ()=>{
    console.log(`GSX2JSON listening on port ${port}`);
});
