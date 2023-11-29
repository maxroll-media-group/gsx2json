import dotenv from 'dotenv';
import request from 'request';
dotenv.config();
const gauthkey = process.env.GOOGLE_AUTH_KEY;
export default function(req, res, next) {
    try {
        const params = req.query;
        const api_key = params.api_key || gauthkey;
        const { id, sheet } = params;
        const query = params.q;
        const useIntegers = params.integers || true;
        const showRows = params.rows || true;
        const showColumns = params.columns || true;
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${id}/values/${sheet}?key=${api_key}`;
        request(url, (error, response, body)=>{
            if (!id) {
                return res.status(response.statusCode).json('You must provide a sheet ID');
            }
            if (!sheet) {
                return res.status(response.statusCode).json('You must provide a sheet name');
            }
            if (!error && response.statusCode === 200) {
                const data = JSON.parse(response.body);
                const responseObj = {};
                const rows = [];
                const columns = {};
                if (data && data.values) {
                    const headings = data.values[0];
                    data.values.slice(1).forEach((entry)=>{
                        const newRow = {};
                        let queried = !query;
                        entry.forEach((value, j)=>{
                            const name = headings[j];
                            if (query && value.toLowerCase().includes(query.toLowerCase())) {
                                queried = true;
                            }
                            if (Object.keys(params).includes(name) && value.toLowerCase() === params[name]?.toLowerCase()) {
                                queried = true;
                            }
                            if (useIntegers === true && !isNaN(Number(value))) {
                                value = Number(value);
                            }
                            newRow[name] = value;
                            if (queried) {
                                columns[name] = columns[name] || [];
                                columns[name].push(value);
                            }
                        });
                        if (queried) {
                            rows.push(newRow);
                        }
                    });
                    if (showColumns) {
                        responseObj['columns'] = columns;
                    }
                    if (showRows) {
                        responseObj['rows'] = rows;
                    }
                    return res.status(200).json(responseObj);
                } else {
                    return res.status(response.statusCode).json(JSON.parse(response.body).error);
                }
            } else {
                return res.status(response.statusCode).json(JSON.parse(response.body).error);
            }
        });
    } catch (error) {
        return res.status(500).json({
            error: 'Internal Server Error'
        });
    }
}
