import bodyParser from 'body-parser';
import express from 'express';
import api from './api.js';
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
// healthz
app.get('/healthz', (req, res)=>{
	res.send('OK');
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
