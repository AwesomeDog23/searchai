import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import dotenv from "dotenv";
import natural from "natural";

dotenv.config();

const TfIdf = natural.TfIdf;
const tfidf = new TfIdf();

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

app.use(express.static(join(__dirname, "public")));

let allProducts = [];

const fetchProducts = async () => {
  const query = `
    {
      products(first: 250, query: "status:active") {
        edges {
          node {
            id
            title
            handle
            descriptionHtml
            tags
          }
        }
      }
    }
  `;

  const url = `https://${SHOP_NAME}.myshopify.com/admin/api/2023-01/graphql.json`;

  const headers = {
    "Content-Type": "application/json",
    "X-Shopify-Access-Token": ACCESS_TOKEN,
    Authorization:
      "Basic " +
      Buffer.from(API_KEY + ":" + PASSWORD).toString("base64"),
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: headers,
      body: JSON.stringify({ query: query }),
    });

    const jsonResponse = await response.json();

    if (
      jsonResponse &&
      jsonResponse.data &&
      jsonResponse.data.products &&
      jsonResponse.data.products.edges
    ) {
      jsonResponse.data.products.edges.forEach((productEdge, i) => {
        if (productEdge && productEdge.node) {
          const product = productEdge.node;
          allProducts.push(product);
          tfidf.addDocument(
            `${product.title} ${product.tags.join(" ")}`
          );
        } else {
          console.error("Unexpected productEdge:", productEdge);
        }
      });
    } else {
      console.error("Unexpected jsonResponse:", jsonResponse);
    }
  } catch (error) {
    console.error("Error fetching products:", error.message);
  }
};

fetchProducts();

import { readFile } from "fs/promises";

app.get("/independent.html", async (req, res) => {
  try {
    const fileContent = await readFile(
      join(__dirname, "public", "independent.html"),
      "utf8"
    );
    res.send(fileContent);
  } catch (error) {
    res.status(500).send("Error: Cannot find the independent.html file");
  }
});

app.post("/api/completions", async (req, res) => {
  const messageHistory = req.body.messageHistory;
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: messageHistory,
      }),
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
    });

    const jsonResponse = await response.json();
    res.send(jsonResponse);
  } catch (error) {
    console.error("Error with API call:", error);
    res.status(500).send("Error with API call");
  }
});

app.post("/shopify-api", async (req, res) => {
  const query = req.body.query;

  const url = `https://${SHOP_NAME}.myshopify.com/admin/api/2023-01/graphql.json`;

  const headers = {
    "Content-Type": "application/json",
    "X-Shopify-Access-Token": ACCESS_TOKEN,
    Authorization:
      "Basic " +
      Buffer.from(API_KEY + ":" + PASSWORD).toString("base64"),
  };

  try {
    console.log(query);
    const response = await fetch(url, {
      method: "POST",
      headers: headers,
      body: JSON.stringify({ query: query }),
    });

    const jsonResponse = await response.json();
    console.log(jsonResponse);
    res.json(jsonResponse);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/products", (req, res) => {
  if (req.query.query) {
    const searchTerm = req.query.query;
    const results = [];

    tfidf.tfidfs(searchTerm, function (i, measure) {
      results.push({ index: i, measure });
    });

    results.sort((a, b) => b.measure - a.measure);
    const topResults = results.slice(0, 10).map((result) => {
      const product = allProducts[result.index];
      // filter out tags that start with "cf" and slice to the first 10
      product.tags = product.tags.filter(tag => !tag.startsWith('cf')).slice(0, 10);
      return product;
    });

    res.json({ products: topResults, query: req.query.query }); // use res.json() instead of res.render()
  } else {
    const products = allProducts.map(product => {
      // filter out tags that start with "cf" and slice to the first 10
      product.tags = product.tags.filter(tag => !tag.startsWith('cf')).slice(0, 10);
      return product;
    });
    res.json({ products }); // use res.json() here too
  }
});

app.get("/", (req, res) => {
  res.render("search");
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});