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
        const productDetails = products.map(p => `title: ${p.handle} - tags: ${p.tags.join(', ')}`).join(' | ');
        console.log(productDetails);
        const queryMessage = [{
            role: "system",
            content: `pick at most 5 products but never more than 5 from this list keeping in mind the titles and the tags when choosing, only saying the title in the exact same format seperated by commas, and include the dashes:\n - ${productDetails}\n that fits this request best based on the tags and titles of each item: ${input}\n Dont include any periods or say anything other than just the list of items. Also do not include the request, only the list of items.`
        }];

        const response = await fetch("/api/completions", {
            method: "POST",
            body: JSON.stringify({ messageHistory: queryMessage }),
            headers: {
                "content-type": "application/json",
            },
        });
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
            const product_links = await pickProducts(input, query);
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