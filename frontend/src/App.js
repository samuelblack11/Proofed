import React, { useState, useCallback, useRef, useEffect} from 'react';
import './App.css';

function App() {
  const [file, setFile] = useState(null);
  const [fileName, setFileName] = useState('');
  const [dragging, setDragging] = useState(false);
  const [proofreadFileUrl, setProofreadFileUrl] = useState('');
  const [changesFileUrl, setChangesFileUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isUploaded, setIsUploaded] = useState(false);
  const fileInputRef = useRef(null); // Reference for the file input
  const [isMobileView, setIsMobileView] = useState(window.innerWidth <= 600);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const handleResize = () => {
      setIsMobileView(window.innerWidth <= 600);
    };

    // Add event listener
    window.addEventListener('resize', handleResize);

    // Clean up event listener
    return () => window.removeEventListener('resize', handleResize);
  }, []);


  const handleReset = () => {
    setFile(null);
    setFileName('');
    setIsUploaded(false);
    setProofreadFileUrl('');
    setChangesFileUrl('');
    fileInputRef.current.value = ''; // Reset the file input
    setErrorMessage('');
  };

const handleFileChange = event => {
  const selectedFile = event.target.files[0];
  if (selectedFile && (selectedFile.type === "application/pdf" || selectedFile.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document")) {
    setFile(selectedFile);
    setFileName(selectedFile ? selectedFile.name : '');
    setIsUploaded(false);
    setProofreadFileUrl('');
    setChangesFileUrl('');
    setErrorMessage(''); // Clear any previous error messages
  } else {
    setErrorMessage('Please select a valid .docx or .pdf file.');
  }
};


  const handleDrop = useCallback(event => {
    event.preventDefault();
    event.stopPropagation();
    setDragging(false);
    if (event.dataTransfer.files && event.dataTransfer.files[0]) {
      setFile(event.dataTransfer.files[0]);
    }
  }, []);

  const handleDragOver = useCallback(event => {
    event.preventDefault();
    event.stopPropagation();
    if (!dragging) {
      setDragging(true);
    }
  }, [dragging]);

  const handleDragLeave = useCallback(event => {
    event.preventDefault();
    event.stopPropagation();
    setDragging(false);
  }, []);

const handleUpload = async () => {
  if (!file || isUploaded) {
    return;
  }

  console.log("---------");
  console.log('handleUpload triggered');
  setIsLoading(true);

  const formData = new FormData();
  formData.append('file', file);

  try {
    const response = await fetch('/upload', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorResponse = await response.json(); // Read the error response body
      throw new Error(errorResponse.errorMessage || `Server responded with status: ${response.status}`);
    }

    const result = await response.json(); // Read the successful response body
    console.log('Response from server:', result);

    // Handle proofread file URL
    if (result.filePath) {
      const proofreadUrl = `http://localhost:8080/${result.filePath}`;
      setProofreadFileUrl(proofreadUrl);
    }

    // Handle changes file URL
    if (result.changes) {
      const changesBlob = new Blob([result.changes], { type: 'text/plain' });
      const changesUrl = URL.createObjectURL(changesBlob);
      setChangesFileUrl(changesUrl);
    }

    setIsUploaded(result.filePath ? true : false);
  } catch (error) {
    console.error('Error during file upload:', error);
    setIsUploaded(false);
    setErrorMessage(error.message); // Set the error message state to display to the user
  } finally {
    setIsLoading(false);
  }
};



  return (
    <div className="appContainer">
      <h1 className="appTitle">Proofed</h1> {/* Title */}
      <p className="appDescription">
         A simple tool to proofread and correct your documents (docx or pdf only). {isMobileView ? "Select a file to get started." : "Drag and drop or select a file to get started."}
      </p>
      <div className="flexColumnCenter">
        <div 
          className={`dropArea ${dragging ? 'dropAreaDragging' : 'dropAreaNormal'} ${isMobileView ? 'hide' : ''}`} 
          onDrop={handleDrop} 
          onDragOver={handleDragOver} 
          onDragLeave={handleDragLeave}
        >
          Drag and drop a file here
        </div>
        <div className="flexRowSpaceBetween">
          <label htmlFor="fileInput" className="label">
            Choose File
          </label>
          <input 
            ref={fileInputRef} 
            id="fileInput" 
            type="file" 
            onChange={handleFileChange}
            accept=".docx, .pdf" 
            className="hiddenInput"
          />
          <button 
            onClick={handleUpload}
            className={!file || isUploaded ? 'disabledButton' : 'button'}
          >
            Upload File
          </button>
          <button 
            onClick={handleReset} 
            disabled={!file} 
            className={!file ? 'disabledResetButton' : 'resetButton'}
          >
            Reset
          </button>
        </div>
      </div>
      {isLoading && (
        <div className="loadingContainer">
          <div className="spinner"></div>
          <p>Loading...</p>
        </div>
      )}
      {file && !isUploaded && <p className="fileStatus">File ready to upload: {fileName}</p>}
      <div className="downloadLinksContainer">
      {proofreadFileUrl && (
        <a href={proofreadFileUrl} download={`proofed_${fileName ? fileName.replace(/\.[^/.]+$/, ".txt") : 'file.txt'}`} className="downloadLink">
          Download Proofread File
        </a>
        )}
        {changesFileUrl && (
          <a href={changesFileUrl} download="changes.txt" className="downloadLink">
            Download Changes File
          </a>
        )}
      </div>
      {errorMessage && <p className="errorMessage">{errorMessage}</p>}
    </div>
  );
}

export default App;
