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

    if (query.length > 0) {
        searchProductsByTags(query)
            .then((product_links) => {
                const displayMessage = message;

                const AnswerLog = messageHistory.map((msg, index) => {
                    if (msg.role === "system") return "";
                    return `<br><br>${msg.role === "user" ? "ME" : "AI"
                        }: ${msg.content}`;
                });

                if (product_links.length > 0) {
                    const product_links_html = product_links
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
                    message += "<br><br>" + product_links_html;
                }
                messageHistory.push({ role: "assistant", content: displayMessage });

                document.forms["input"]["input"].value = "";
                document.getElementById("output").innerHTML =
                    AnswerLog.join("") + `<br><br>AI: ${message}`;

                // Re-enable input field and Send button after processing request
                document.forms["input"]["input"].disabled = false;
                document.forms["input"]["submit"].disabled = false;
            })
            .catch((error) => {
                console.error("Error displaying product links:", error);
            });
    } else {
        messageHistory.push({ role: "assistant", content: aiReply });

        const AnswerLog = messageHistory.map((msg, index) => {
            if (msg.role === "system") return "";
            return `<br><br>${msg.role === "user" ? "ME" : "AI"}: ${msg.content}`;
        });

        // Re-enable input field and Send button after processing request
        document.forms["input"]["input"].disabled = false;
        document.forms["input"]["submit"].disabled = false;
    }
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