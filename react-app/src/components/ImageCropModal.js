import React, { useState, useCallback } from "react";
import Cropper from "react-easy-crop";
import "./ImageCropModal.css";

const ImageCropModal = ({ imageSrc, onCropComplete, onCancel }) => {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

  const onCropAreaChange = useCallback((croppedArea, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const createImage = (url) =>
    new Promise((resolve, reject) => {
      const image = new Image();
      image.addEventListener("load", () => resolve(image));
      image.addEventListener("error", (error) => reject(error));
      image.src = url;
    });

  const getCroppedImg = async () => {
    try {
      const image = await createImage(imageSrc);
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      const size = 1000; // Output 1000x1000px square
      canvas.width = size;
      canvas.height = size;

      const scaleX = size / croppedAreaPixels.width;
      const scaleY = size / croppedAreaPixels.height;

      ctx.drawImage(
        image,
        croppedAreaPixels.x,
        croppedAreaPixels.y,
        croppedAreaPixels.width,
        croppedAreaPixels.height,
        0,
        0,
        size,
        size
      );

      return new Promise((resolve) => {
        canvas.toBlob(
          (blob) => {
            const file = new File([blob], "cropped-image.jpg", {
              type: "image/jpeg",
              lastModified: Date.now(),
            });
            resolve(file);
          },
          "image/jpeg",
          0.95
        );
      });
    } catch (e) {
      console.error("Error cropping image:", e);
      return null;
    }
  };

  const handleCropConfirm = async () => {
    const croppedFile = await getCroppedImg();
    if (croppedFile) {
      onCropComplete(croppedFile);
    }
  };

  return (
    <div className="crop-modal-overlay">
      <div className="crop-modal">
        <div className="crop-modal-header">
          <h3>Crop Your Image</h3>
          <p>Drag to position, scroll to zoom</p>
        </div>

        <div className="crop-container">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={1}
            onCropChange={setCrop}
            onCropComplete={onCropAreaChange}
            onZoomChange={setZoom}
            cropShape="rect"
            showGrid={true}
          />
        </div>

        <div className="crop-controls">
          <div className="zoom-control">
            <label>Zoom</label>
            <input
              type="range"
              value={zoom}
              min={1}
              max={3}
              step={0.1}
              onChange={(e) => setZoom(e.target.value)}
              className="zoom-slider"
            />
          </div>
        </div>

        <div className="crop-actions">
          <button onClick={onCancel} className="crop-cancel-btn">
            Cancel
          </button>
          <button onClick={handleCropConfirm} className="crop-confirm-btn">
            Apply Crop
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImageCropModal;
