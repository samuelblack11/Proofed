import React, { useState, useCallback, useRef} from 'react';
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

  const handleReset = () => {
    setFile(null);
    setFileName('');
    setIsUploaded(false);
    setProofreadFileUrl('');
    setChangesFileUrl('');
    fileInputRef.current.value = ''; // Reset the file input
  };

  const handleFileChange = event => {
    const selectedFile = event.target.files[0];
    setFile(selectedFile);
    setFileName(selectedFile ? selectedFile.name : '');
    setIsUploaded(false);
    setProofreadFileUrl('');
    setChangesFileUrl('');
  };

  const dropAreaStyle = {
    border: '2px dashed white',
    padding: '20px',
    margin: '20px',
    marginBottom: '10px',
    borderRadius: '10px',
    backgroundColor: dragging ? 'rgba(255, 255, 255, 0.2)' : 'transparent',
    width: '60vw',
    height: '60vh',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center'
  };

  const buttonStyle = {
    backgroundColor: 'white',
    color: 'navy',
    border: 'none',
    padding: '10px 20px',
    borderRadius: '5px',
    cursor: 'pointer',
    margin: '10px',
    width: '150px',
    height: '40px'
  };

  const resetButtonStyle = {
    ...buttonStyle,
    backgroundColor: '#CC0000',
  };

  const disabledResetButtonStyle = {
    ...buttonStyle,
    backgroundColor: '#ffcccc',
    color: '#a0a0a0',
    cursor: 'not-allowed',
  };

  const disabledButtonStyle = {
    ...buttonStyle,
    backgroundColor: '#ccc',
    color: 'darkgrey',
    cursor: 'not-allowed',
  };

  const labelStyle = {
    ...buttonStyle,
    display: 'inline-flex', // Use flex to center the content
    alignItems: 'center', // Align items vertically
    justifyContent: 'center', // Center content horizontally
    boxSizing: 'border-box', // Include padding and border in the element's total width and height
    overflow: 'hidden', // Prevent overflow
    cursor: 'pointer',
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
  try {
  console.log('handleUpload triggered')
  setIsLoading(true);
}
catch(error) {
  console.error('Error in handleUpload:', error)
}

  const formData = new FormData();
  formData.append('file', file);

  try {
    const response = await fetch('http://localhost:3000/upload', {
      method: 'POST',
      body: formData,
    });

    console.log('Response Status:', response.status); // Log the status code
    console.log('Response Status Text:', response.statusText); // Log the status text

    const result = await response.json(); // Attempt to read the response body
    console.log('Response Body:', result); // Log the response body

    if (response.ok) {
      const result = await response.json();
      console.log('Response from server:', result); // Debugging the response

      if (result.proofreadText && result.changes) {
        const proofreadBlob = new Blob([result.proofreadText], { type: 'text/plain' });
        const proofreadUrl = URL.createObjectURL(proofreadBlob);
        console.log('Proofread URL:', proofreadUrl); // Debugging the URL

        const changesBlob = new Blob([result.changes.join('\n')], { type: 'text/plain' });
        const changesUrl = URL.createObjectURL(changesBlob);
        console.log('Changes URL:', changesUrl); // Debugging the URL

        setProofreadFileUrl(proofreadUrl);
        setChangesFileUrl(changesUrl);
        setIsUploaded(true);
      } else {
        console.error('Missing data in response');
        setIsUploaded(false);
      }
    } else {
      console.error('Error response from server:', response.status);
      setIsUploaded(false);
    }
  } catch (error) {
    console.error('Error uploading file:', error);
    setIsUploaded(false);
  }
  setIsLoading(false);
};

  return (
    <div style={{
      textAlign: 'center',
      fontFamily: 'Roboto, Arial, sans-serif',
      backgroundColor: '#001233',
      color: 'white',
      padding: '20px',
      width: '100vw',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center'
    }}>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        width: '100%'
      }}>
        <div style={dropAreaStyle} onDrop={handleDrop} onDragOver={handleDragOver} onDragLeave={handleDragLeave}>
          Drag and drop a file here
        </div>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          width: '100%',
          maxWidth: dropAreaStyle.width,
          position: 'relative',
        }}>
          <label htmlFor="fileInput" style={labelStyle}>
            Choose File
          </label>
          <input ref={fileInputRef} id="fileInput" type="file" onChange={handleFileChange} style={{ display: 'none', width: 0, height: 0 }}/>
          <button onClick={handleUpload} disabled={!file || isUploaded} style={!file || isUploaded ? disabledButtonStyle : buttonStyle}>
            Upload File
          </button>

          <button onClick={handleReset} disabled={!file} style={!file ? disabledResetButtonStyle : resetButtonStyle}>
            Reset
          </button>
        </div>
      </div>

      {isLoading && (
        <div style={{ margin: '20px' }}>
          <div className="spinner"></div>
          <p>Loading...</p>
        </div>
      )}
      {file && !isUploaded && <p style={{ marginTop: '10px' }}>File ready to upload: {fileName}</p>}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        gap: '20px',
        marginTop: '10px'
      }}>
        {proofreadFileUrl && (
          <a href={proofreadFileUrl} download="proofread.txt" style={{ color: 'white' }}>
            Download Proofread File
          </a>
        )}
        {changesFileUrl && (
          <a href={changesFileUrl} download="changes.txt" style={{ color: 'white' }}>
            Download Changes File
          </a>
        )}
      </div>
    </div>
  );
}

export default App;
