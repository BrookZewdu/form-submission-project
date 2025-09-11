import React, { useState } from "react";
import { useDropzone } from "react-dropzone";
import axios from "axios";
import ImageCropModal from "./ImageCropModal";
import "./SubmissionForm.css";

const SubmissionForm = () => {
  const [formData, setFormData] = useState({
    name: "",
  });
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [tempImageSrc, setTempImageSrc] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Handle file drop/selection
  const onDrop = (acceptedFiles, rejectedFiles) => {
    // Clear any previous messages
    setMessage({ type: "", text: "" });

    // Handle rejected files
    if (rejectedFiles.length > 0) {
      const rejection = rejectedFiles[0];
      if (rejection.errors.some((error) => error.code === "file-too-large")) {
        setMessage({
          type: "error",
          text: "File too large. Maximum size is 10MB.",
        });
      } else if (
        rejection.errors.some((error) => error.code === "file-invalid-type")
      ) {
        setMessage({
          type: "error",
          text: "Only image files (JPG, PNG, GIF, WebP) are allowed.",
        });
      } else {
        setMessage({
          type: "error",
          text: "Invalid file. Please try again.",
        });
      }
      return;
    }

    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0];
      const reader = new FileReader();

      reader.onload = () => {
        setTempImageSrc(reader.result);
        setCropModalOpen(true);
      };

      reader.readAsDataURL(file);
    }
  };

  const handleCropComplete = (croppedFile) => {
    setSelectedFile(croppedFile);

    // Create preview URL
    const preview = URL.createObjectURL(croppedFile);
    setPreviewUrl(preview);

    setCropModalOpen(false);
    setTempImageSrc(null);

    setMessage({
      type: "success",
      text: "Image cropped successfully!",
    });
  };

  const handleCropCancel = () => {
    setCropModalOpen(false);
    setTempImageSrc(null);
    setMessage({
      type: "info",
      text: "Image selection cancelled",
    });
  };

  // Configure dropzone
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/jpeg": [".jpg", ".jpeg"],
      "image/png": [".png"],
      "image/gif": [".gif"],
      "image/webp": [".webp"],
    },
    maxSize: 10 * 1024 * 1024, // 10MB
    multiple: false,
  });

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validation
    if (!formData.name.trim()) {
      setMessage({ type: "error", text: "Name is required" });
      return;
    }

    if (!selectedFile) {
      setMessage({ type: "error", text: "Please select and crop an image" });
      return;
    }

    setIsSubmitting(true);
    setMessage({ type: "", text: "" });

    try {
      // Create FormData
      const submitData = new FormData();
      submitData.append("name", formData.name.trim());
      submitData.append("image", selectedFile, "cropped-image.jpg");

      // Submit to backend
      const response = await axios.post("/api/submit", submitData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      if (response.data.success) {
        setMessage({
          type: "success",
          text: "Form submitted successfully! Thank you.",
        });

        // Reset form
        setFormData({ name: "" });
        setSelectedFile(null);
        setPreviewUrl(null);

        // Clear preview URL
        if (previewUrl) {
          URL.revokeObjectURL(previewUrl);
        }
      } else {
        setMessage({
          type: "error",
          text: response.data.error || "Submission failed",
        });
      }
    } catch (error) {
      console.error("Submission error:", error);

      if (error.response?.data?.error) {
        setMessage({
          type: "error",
          text: error.response.data.error,
        });
      } else if (error.code === "NETWORK_ERROR") {
        setMessage({
          type: "error",
          text: "Cannot connect to server. Please check if the backend is running.",
        });
      } else {
        setMessage({
          type: "error",
          text: "An error occurred. Please try again.",
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Clean up preview URL on unmount
  React.useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  return (
    <>
      <div className="submission-form-container">
        <form onSubmit={handleSubmit} className="submission-form">
          <h2 className="form-title">Form</h2>

          {/* Name Field */}
          <div className="form-section">
            <label className="form-label">
              Name <span className="required">*</span>
            </label>
            <div className="input-group">
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                className="form-input"
                placeholder=""
                required
              />
              <label className="input-label">Enter image name</label>
            </div>
          </div>

          {/* Image Upload */}
          <div className="form-section">
            <label className="form-label">
              Upload Image <span className="required">*</span>
            </label>

            <div
              {...getRootProps()}
              className={`dropzone ${isDragActive ? "dropzone-active" : ""} ${
                selectedFile ? "dropzone-has-file" : ""
              }`}
            >
              <input {...getInputProps()} />

              {!selectedFile ? (
                <div className="dropzone-content">
                  <div className="cloud-icon">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14,2 14,8 20,8" />
                      <line x1="16" y1="13" x2="8" y2="13" />
                      <line x1="16" y1="17" x2="8" y2="17" />
                      <polyline points="10,9 9,9 8,9" />
                    </svg>
                  </div>
                  <div className="dropzone-text">
                    <p className="browse-text">Browse Files</p>
                    <p className="drag-text">Drag and drop files here</p>
                    <p className="crop-info">Image will be cropped to square</p>
                  </div>
                </div>
              ) : (
                <div className="file-preview">
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="preview-image"
                  />
                  <div className="file-info">
                    <p className="file-name">Cropped Square Image</p>
                    <p className="file-size">1000x1000 px</p>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedFile(null);
                        setPreviewUrl(null);
                        setMessage({ type: "", text: "" });
                      }}
                      className="remove-file-btn"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {message.text && (
            <div className={`message ${message.type}`}>{message.text}</div>
          )}

          <div className="form-section">
            <button
              type="submit"
              className="submit-btn"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <span className="loading-text">
                  <span className="spinner"></span>
                  Submitting...
                </span>
              ) : (
                "Submit"
              )}
            </button>
          </div>
        </form>
      </div>

      {cropModalOpen && (
        <ImageCropModal
          imageSrc={tempImageSrc}
          onCropComplete={handleCropComplete}
          onCancel={handleCropCancel}
        />
      )}
    </>
  );
};

export default SubmissionForm;
