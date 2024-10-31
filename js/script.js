// Function to handle dropped files and display their names and sizes in the preview area
function handleFiles(files, previewElementId) {
  // Get the preview area element by its ID
  const preview = document.getElementById(previewElementId);
  // Clear any existing content in the preview area
  preview.innerHTML = "";

  // Loop through each dropped file
  for (const file of files) {
    // Create a new <p> element to display the file name and size
    const fileItem = document.createElement("p");
    // Set the text content of the <p> element to display the file name and size (converted to kilobytes)
    fileItem.textContent = `File: ${file.name} (${(file.size / 1024).toFixed(
      2
    )} KB)`;
    // Append the <p> element to the preview area
    preview.appendChild(fileItem);
  }
}

// Add event listeners to all elements with the class "upload-area" to handle drag and drop functionality
document.querySelectorAll(".upload-area").forEach((uploadArea) => {
  // When a file is dragged over an upload area, prevent the default behavior and add the "dragging" class
  uploadArea.addEventListener("dragover", (event) => {
    event.preventDefault();
    uploadArea.classList.add("dragging");
  });

  // When a file is dragged out of an upload area, remove the "dragging" class
  uploadArea.addEventListener("dragleave", () => {
    uploadArea.classList.remove("dragging");
  });

  // When a file is dropped onto an upload area, prevent the default behavior, remove the "dragging" class, and call the handleFiles function with the dropped files and the ID of the preview area
  uploadArea.addEventListener("drop", (event) => {
    event.preventDefault();
    uploadArea.classList.remove("dragging");
    const files = event.dataTransfer.files;
    if (uploadArea.id === "uploadArea1") {
      handleFiles(files, "preview1");
    } else if (uploadArea.id === "uploadArea2") {
      handleFiles(files, "preview2");
    }
  });
});
