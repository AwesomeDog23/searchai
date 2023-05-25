let messageHistory = [
    {
        role: "system",
        content:
            "You are a helpful assistant that provides detailed and accurate information.",
    },
];

async function fetchProductDetailsByHandle(handle) {
    const query = `
        {
          productByHandle(handle: "${handle}") {
            id
            title
            handle
            tags
            images(first: 1) {
              edges {
                node {
                  transformedSrc
                }
              }
            }
          }
        }
    `;

    try {
        const response = await fetch("/shopify-api", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ query }),
        });

        const jsonResponse = await response.json();

        if (
            jsonResponse &&
            jsonResponse.data &&
            jsonResponse.data.productByHandle
        ) {
            const product = jsonResponse.data.productByHandle;
            return {
                id: product.id,
                title: product.title,
                handle: product.handle,
                imageUrl: product.images.edges[0]?.node.transformedSrc,
                tags: product.tags,
            };
        }
    } catch (error) {
        console.error("Error fetching product details:", error);
    }

    return null;
}

async function searchProductsByTags(query = "") {
    try {
        const response = await fetch(`/products?query=${query}`, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
            }
        });

        const jsonResponse = await response.json();

        if (jsonResponse && jsonResponse.products) {
            const productPromises = jsonResponse.products
                .slice(0, 10)
                .map((product) => fetchProductDetailsByHandle(product.handle));

            // Await the promises and return the resulting array of products
            return await Promise.all(productPromises);
        }
    } catch (error) {
        console.error("Error fetching products:", error);
    }
    return [];
}

const pickProducts = async (input, query) => {
    try {
        const result = await searchProductsByTags(query);
        const products = await result;
        console.log(products);
        // construct a string of product details
        const productDetails = products.map(p => `Title: ${p.handle} - Tags: ${p.tags.join(', ')}`).join(' | ');
        console.log(productDetails);
        const queryMessage = [{
            role: "system",
            content: `Please pick at most 5 products from this list that fit the following criteria: 
- The product name must match the exact format provided in the list of products, separated by commas and including the dashes in the title.
- If the product has tags that match the user's message in meaning or exact text, it should always be included in the response above any items that do not have them, for example if the item has a tag that says pink at all in it, and the user asked for a pink dress it should be included.
- The product should have a title that relates to the keywords in the user's message.

List of products: ${productDetails}

User's messages: ${input}

Please do not include any periods or any other text besides the list of products. Also, do not include the original request in your response.
Example response: pink-dress, green-dress, blue-dress
`
        }];

        const response = await fetch("/api/completions", {
            method: "POST",
            body: JSON.stringify({ messageHistory: queryMessage }),
            headers: {
                "content-type": "application/json",
            },
        });
        console.log(response);
        const data = await response.json();
        const content = data.choices[0].message.content
        console.log(content);

        // Assuming the response is in the form of a string of product titles separated by commas
        // Convert the string into an array
        const productArray = content.split(', ');

        // Construct an array of objects that contain the required information for each selected product
        const selectedProducts = products.filter(p => productArray.includes(p.handle)).map(p => {
            return {
                title: p.title,
                imageUrl: p.imageUrl,
                handle: p.handle
            };
        });
        return selectedProducts;

    } catch (error) {
        console.error(`Error: ${error}`);
    }
}


const userAction = async (event) => {
    event.preventDefault();
    const input = document.forms["input"]["input"].value;
    const aiInput = messageHistory
        .filter((msg) => msg.role === "user")
        .map((msg) => msg.content)
        .join(" ");

    messageHistory.push({ role: "user", content: input });

    document.forms["input"]["input"].disabled = true;
    document.forms["input"]["submit"].disabled = true;

    const response = await fetch("/api/completions", {
        method: "POST",
        body: JSON.stringify({ messageHistory: messageHistory }),
        headers: {
            "content-type": "application/json",
        },
    });

    const jsonResponse = await response.json();
    const aiReply = jsonResponse.choices[0].message.content;

    let message = aiReply;
    let query = "";
    console.log(aiReply);
    if (aiReply.includes("QUERY:")) {
        [message, query] = aiReply.split("QUERY:").map((str) => str.trim());
    }

    let product_links_html = "";

    if (query.length > 0) {
        try {
            const product_links = await pickProducts(aiInput, query);
            if (product_links.length > 0) {
                product_links_html = product_links
                    .slice(0, 5)
                    .map((link) => {
                        return `
                        <a href="https://taylorjoelle.com/products/${link.handle}" target="_blank" style="text-decoration: none; color: inherit;">
                            <div class="product-container">
                                <img src="${link.imageUrl}" alt="${link.title}">
                                <div class="product-title">${link.title}</div>
                            </div>
                        </a>
                    `;
                    })
                    .join("");
            }
        } catch (error) {
            console.error("Error displaying product links:", error);
        }
    }

    messageHistory.push({ role: "assistant", content: message });

    const AnswerLog = messageHistory
        .filter((msg) => msg.role !== "system")
        .map((msg) => `<br><br>${msg.role === "user" ? "ME" : "AI"}: ${msg.content}`);

    document.getElementById("output").innerHTML =
        AnswerLog.join("") + (product_links_html ? `<br><br>${product_links_html}` : "");

    document.forms["input"]["input"].disabled = false;
    document.forms["input"]["submit"].disabled = false;
};

const clearHistory = () => {
    const newSystemMessage = document.forms["systemMessageForm"]["systemMessage"].value;
    messageHistory = [
        {
            role: "system",
            content: newSystemMessage,
        },
    ];
    document.getElementById("output").innerHTML = "";
};

const addCustomOption = () => {
    const customOption = document.forms["addOptionForm"]["customOption"].value;
    if (customOption === "") return; // Don't add an empty option

    const selectElement = document.forms["systemMessageForm"]["systemMessage"];
    const newOption = document.createElement("option");
    newOption.value = customOption;
    newOption.text = customOption;
    selectElement.add(newOption);

    document.forms["addOptionForm"]["customOption"].value = ""; // Clear the input field
};