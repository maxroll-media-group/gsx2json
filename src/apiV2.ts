import dotenv from 'dotenv'
import express from 'express'
import request from 'request'
import fs from 'fs'
dotenv.config()

const gauthkey = process.env.GOOGLE_AUTH_KEY

type keywords = 'tags' | 'shortcode'

interface QueryParams {
  api_key?: string
  id?: string
  sheet?: string
  q?: string
  integers?: boolean
  rows?: boolean
  columns?: boolean
  keywords?: keywords
}

// Helper function to convert RGB values to hex
function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => {
    const hex = Math.round(n * 255).toString(16)
    if (!n) {
      return '00'
    }
    return hex.length === 1 ? '0' + hex : hex
  }
  return toHex(r) + toHex(g) + toHex(b)
}

// Helper function to wrap text with color information
function wrapTextWithKeyword(text: string, formats: any, keywordsFormat: keywords): string {
  let newText = ''
  let index = 0
  
  for (const entry of formats) {
    if (entry.format.foregroundColor) {
      const foregroundColor = entry.format.foregroundColor
      if (Object.keys(foregroundColor).length >= 1) {
        const startIndex = formats[index].startIndex || 0
        const endIndex = formats[index + 1]?.startIndex || text.length
        const slicedText = text.slice(startIndex, endIndex)
        
        const color = rgbToHex(foregroundColor.red, foregroundColor.green, foregroundColor.blue)
        const bold = entry.format.bold
        if (keywordsFormat === 'tags') {
          newText += `<keyword id="#${color}"${bold ? ' bold=true' : ''}>${slicedText}</keyword>`
        } else if (keywordsFormat === 'shortcode') {
          newText += `[keyword id="#${color}"${bold ? ' bold=true' : ''}]${slicedText}[/keyword]`
        }
      } else {
      const startIndex = formats[index].startIndex || 0
      const endIndex = formats[index + 1]?.startIndex || text.length
      const slicedText = text.slice(startIndex, endIndex)

      newText += slicedText
      }
    } else {
      // used the same else for both of the ifs in order to avoid weird behavior for regular text that sometimes has color and sometimes doesn't in the google sheets api response
      const startIndex = formats[index].startIndex || 0
      const endIndex = formats[index + 1]?.startIndex || text.length
      const slicedText = text.slice(startIndex, endIndex)

      newText += slicedText
    }

    index++
  }

  return newText
}

export default function (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
): void {
  try {
    const params: QueryParams = req.query
    const api_key = params.api_key || gauthkey
    const { id, sheet } = params
    const query = params.q
    const useIntegers = params.integers || true
    const showRows = params.rows || true
    const showColumns = params.columns || true
    const keywordFormat = params.keywords

    if (!id) {
      void res.status(400).json('You must provide a sheet ID')
      return
    }
    if (!sheet) {
      void res.status(400).json('You must provide a sheet name')
      return
    }

    // If keywords parameter is provided, we need to fetch formatting data
    const shouldFetchFormatting = keywordFormat === 'tags' || keywordFormat === 'shortcode'
    if (shouldFetchFormatting) {
      const batchUrl = `https://sheets.googleapis.com/v4/spreadsheets/${id}?ranges=${sheet}&includeGridData=true&key=${api_key}`
      
      request(batchUrl, (error: any, response: any, body: string) => {
        if (error || response.statusCode !== 200) {
          console.error('API Error:', {
            error,
            statusCode: response?.statusCode,
            body: body?.substring(0, 200)
          })
          void res.status(response?.statusCode || 500).json(
            response?.body ? 'Error fetching formatting data from Google Sheets API' : 'Error fetching data'
          )
          return
        }

        let data
        try {
          data = JSON.parse(response.body)
        } catch (parseError) {
          console.error('JSON Parse Error (formatting):', {
            parseError,
            bodyStart: response.body?.substring(0, 200)
          })
          void res.status(500).json({ error: 'Invalid response from Google Sheets API' })
          return
        }

        const responseObj: any = {}
        const rows: any[] = []
        const columns: { [key: string]: any[] } = {}

        const sheetData = data.sheets.find((sheetItem: any) => sheetItem.properties?.title === sheet)
        if (sheetData) {
          // Extract headers from the first row
          const headerRow = sheetData.data[0].rowData[0].values
          const headers = headerRow.map((cell: any) => cell.formattedValue)

          sheetData.data[0].rowData.slice(1).forEach((rowData: any, index: number) => {
            const values = rowData.values || []
            const newRow: { [key: string]: any } = {}
            let queried = !query

            values.forEach((cell: any, j: number) => {
              const name = headers[j]
              const value = cell.formattedValue

              if (query && value?.toLowerCase().includes(query.toLowerCase())) {
                queried = true
              }
              if (
                Object.keys(params).includes(name) &&
                value?.toLowerCase() === params[name]?.toLowerCase()
              ) {
                queried = true
              }
              if (useIntegers === true && !isNaN(Number(value))) {
                newRow[name] = Number(value)
              } else {
                
                if (rowData.values[j].textFormatRuns) {
                  newRow[name] = wrapTextWithKeyword(value, rowData.values[j].textFormatRuns, keywordFormat)
                } else {
                  newRow[name] = value
                }
              }
              
              if (queried) {
                columns[name] = columns[name] || []
                if (value !== null && value !== undefined) {
                  columns[name].push(value)
                }
              }
            })
            
            if (queried) {
              // Check if the row has any non-null, non-undefined values
              const hasValidValues = Object.values(newRow).some(value => value !== null && value !== undefined && value !== '');
              if (Object.keys(newRow).length > 0 && hasValidValues) {
                rows.push(newRow)
              }
            }
          })
          
          if (showColumns) {
            responseObj['columns'] = columns
          }
          if (showRows) {
            responseObj['rows'] = rows
          }
          void res.status(200).json(responseObj)
        } else {
          void res.status(404).json({ error: 'No data found in sheet' })
        }
      })
    } else {
      // Fallback to original API for backward compatibility when no keywords parameter
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${id}/values/${sheet}?key=${api_key}`

      request(url, (error: any, response: any, body: string) => {
        if (error || response.statusCode !== 200) {
          console.error('API Error (fallback):', {
            error,
            statusCode: response?.statusCode,
            body: body?.substring(0, 200)
          })
          void res.status(response?.statusCode || 500).json(
            response?.body ? 'Error fetching data from Google Sheets API' : 'Error fetching data'
          )
          return
        }

        let data
        try {
          data = JSON.parse(response.body)
        } catch (parseError) {
          console.error('JSON Parse Error (fallback):', {
            parseError,
            bodyStart: response.body?.substring(0, 200)
          })
          void res.status(500).json({ error: 'Invalid response from Google Sheets API' })
          return
        }

        const responseObj: any = {}
        const rows: any[] = []
        const columns: { [key: string]: any[] } = {}

        if (data && data.values) {
          const headings = data.values[0]

          data.values.slice(1).forEach((entry: any[]) => {
            const newRow: { [key: string]: any } = {}
            let queried = !query
            entry.forEach((value, j) => {
              const name = headings[j]
              if (query && value.toLowerCase().includes(query.toLowerCase())) {
                queried = true
              }
              if (
                Object.keys(params).includes(name) &&
                value.toLowerCase() === params[name]?.toLowerCase()
              ) {
                queried = true
              }
              if (useIntegers === true && !isNaN(Number(value))) {
                value = Number(value)
              }
              newRow[name] = value
              if (queried) {
                columns[name] = columns[name] || []
                if (value !== null && value !== undefined) {
                  columns[name].push(value)
                }
              }
            })
            if (queried) {
              // Check if the row has any non-null, non-undefined values
              const hasValidValues = Object.values(newRow).some(value => value !== null && value !== undefined && value !== '');
              if (Object.keys(newRow).length > 0 && hasValidValues) {
                rows.push(newRow)
              }
            }
          })

          if (showColumns) {
            responseObj['columns'] = columns
          }
          if (showRows) {
            responseObj['rows'] = rows
          }
          void res.status(200).json(responseObj)
        } else {
          void res.status(response?.statusCode || 404).json({ error: 'No data found' })
        }
      })
    }
  } catch (error) {
    void res.status(500).json({ error: 'Internal Server Error' })
  }
}