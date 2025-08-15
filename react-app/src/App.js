import React from 'react';
import SubmissionForm from './components/SubmissionForm';
import './App.css';

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <h1>📝 Form Submission</h1>
        <p>Submit your image and its name</p>
      </header>
      
      <main className="App-main">
        <SubmissionForm />
      </main>
      
      <footer className="App-footer">
        <p>Form Submission App - React Frontend</p>
      </footer>
    </div>
  );
}

export default App;
