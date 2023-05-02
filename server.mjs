import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

dotenv.config();

const PORT = process.env.PORT;
const mongodbUri = process.env.MONGODB_URI;

const SHOP_NAME = process.env.SHOP_NAME;
const ACCESS_TOKEN = process.env.ACCESS_TOKEN;
const API_KEY = process.env.API_KEY;
const PASSWORD = process.env.PASSWORD;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);


const app = express();
app.use(cors());
app.use(express.json());

app.use(express.static(join(__dirname, 'public')));

import { readFile } from 'fs/promises';

app.get('/independent.html', async (req, res) => {
  try {
    const fileContent = await readFile(join(__dirname, 'public', 'independent.html'), 'utf8');
    res.send(fileContent);
  } catch (error) {
    res.status(500).send('Error: Cannot find the independent.html file');
  }
});

app.get('/shopify-products', async (req, res) => {
  try {
    const products = await getAllProducts();
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

async function getAllProducts() {
  const url = `https://${SHOP_NAME}.myshopify.com/admin/api/2023-01/graphql.json`;

  const query = `
    {
      products(first: 10) {
        edges {
          node {
            id
            title
            handle
            image {
              transformedSrc
            }
          }
        }
      }
    }
  `;

  const headers = {
    'Content-Type': 'application/json',
    'X-Shopify-Access-Token': ACCESS_TOKEN,
    'Authorization': 'Basic ' + Buffer.from(API_KEY + ':' + PASSWORD).toString('base64'),
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({ query }),
    });

    const jsonResponse = await response.json();
    const products = jsonResponse.data.products.edges.map(edge => edge.node);
    return products;
  } catch (error) {
    console.error("Error fetching products:", error);
    return [];
  }
}


app.post('/api/completions', async (req, res) => {
  const messageHistory = req.body.messageHistory;
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

  try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          body: JSON.stringify({ 'model': 'gpt-3.5-turbo', 'messages': messageHistory }),
          headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${OPENAI_API_KEY}`,
          },
      });

      const jsonResponse = await response.json();
      res.send(jsonResponse);

  } catch (error) {
      console.error('Error with API call:', error);
      res.status(500).send('Error with API call');
  }
});

app.post('/shopify-api', async (req, res) => {
  const query = req.body.query;

  const url = `https://${SHOP_NAME}.myshopify.com/admin/api/2023-01/graphql.json`;

  const headers = {
    'Content-Type': 'application/json',
    'X-Shopify-Access-Token': ACCESS_TOKEN,
    'Authorization': 'Basic ' + Buffer.from(API_KEY + ':' + PASSWORD).toString('base64')
  };

  try {
    console.log(query);
    const response = await fetch(url, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({ query: query })
    });

    const jsonResponse = await response.json();
    console.log(jsonResponse);
    res.json(jsonResponse);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});