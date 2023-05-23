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
        console.log(jsonResponse);
        if (jsonResponse && jsonResponse.products) {
            const productPromises = jsonResponse.products
                .slice(0, 5)
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
        console.log(result);

        const products = result;  // Access the products array from the result

        // construct a string of product details
        const productDetails = products.map(p => `title: ${p.handle} - tags: ${p.tags.join(', ')}`).join(' | ');

        const queryMessage = [{
            role: "system",
            content: `pick 5 products from this list only saying the title in the exact same format seperated by commas - ${productDetails} that fits this request best: ${input}`
        }];

        console.log(queryMessage);

        const response = await fetch("/api/completions", {
            method: "POST",
            body: JSON.stringify({ messageHistory: queryMessage }),
            headers: {
                "content-type": "application/json",
            },
        });
        const data = await response.json();
        console.log(data);
    } catch (error) {
        console.error(`Error: ${error}`);
    }
}


const userAction = async (event) => {
    event.preventDefault();
    const input = "" + document.forms["input"]["input"].value;



    messageHistory.push({ role: "user", content: input });

    // Disable input field and Send button while processing request
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

    let message = "";
    let query = "";

    if (aiReply.includes("QUERY:")) {
        const [messagePart, queryPart] = aiReply.split("QUERY:");
        message = messagePart.trim();
        query = queryPart.trim();
    } else {
        message = aiReply;
    }

    let product_links_html = "";

    if (query.length > 0) {
        try {
            const product_links = pickProducts(input, query);
            if (product_links.length > 0) {
                product_links_html = product_links
                    .slice(0, 5)
                    .map(
                        (link) => `
                <a href="https://taylorjoelle.com/products/${link.handle}" target="_blank" style="text-decoration: none; color: inherit;">
                    <div class="product-container">
                        <img src="${link.imageUrl}" alt="${link.title}">
                        <div class="product-title">${link.title}</div>
                    </div>
                </a>
                `
                    )
                    .join("");
            }
        } catch (error) {
            console.error("Error displaying product links:", error);
        }
    }

    // Always add the assistant's message to the message history
    messageHistory.push({ role: "assistant", content: message });
    console.log(messageHistory);

    const AnswerLog = messageHistory.map((msg, index) => {
        if (msg.role === "system") return "";
        return `<br><br>${msg.role === "user" ? "ME" : "AI"}: ${msg.content}`;
    });

    document.getElementById("output").innerHTML =
        AnswerLog.join("") + (product_links_html ? `<br><br>${product_links_html}` : "");

    // Re-enable input field and Send button after processing request
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