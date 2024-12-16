import React, { useState } from 'react';

function ConstraintManager({ constraints, setConstraints, availableFeatures, onValidationError }) {
  const [newConstraint, setNewConstraint] = useState('');
  const [showTranslationPrompt, setShowTranslationPrompt] = useState(false);
  const [showConfirmationPrompt, setShowConfirmationPrompt] = useState(false);
  const [currentConstraint, setCurrentConstraint] = useState(null);
  const [manualTranslation, setManualTranslation] = useState('');
  const [existingTranslation, setExistingTranslation] = useState(null);

  const handleAddConstraint = async () => {
    if (!newConstraint.trim()) return;

    // Check if a similar English constraint already exists
    const existingConstraint = constraints.find(
      c => c.englishStatement && c.englishStatement.toLowerCase() === newConstraint.toLowerCase()
    );

    if (existingConstraint?.booleanExpression) {
      setExistingTranslation(existingConstraint.booleanExpression);
      setShowConfirmationPrompt(true);
      setCurrentConstraint({
        englishStatement: newConstraint,
        id: Date.now().toString(),
      });
      return;
    }

    try {
      const response = await fetch('http://localhost:5000/translate-constraint', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          englishStatement: newConstraint,
          features: availableFeatures,
        }),
      });

      const data = await response.json();
      
      if (data.error) {
        // Show translation prompt if automatic translation fails
        setShowTranslationPrompt(true);
        setCurrentConstraint({
          englishStatement: newConstraint,
          id: Date.now().toString(),
        });
      } else {
        // Confirm automatic translation
        setExistingTranslation(data.booleanExpression);
        setShowConfirmationPrompt(true);
        setCurrentConstraint({
          englishStatement: newConstraint,
          id: Date.now().toString(),
          type: data.type,
        });
      }
    } catch (error) {
      onValidationError('Failed to translate constraint');
    }
  };

  const addConstraintToList = (constraint) => {
    setConstraints(prev => [...prev, constraint]);
    resetState();
  };

  const resetState = () => {
    setNewConstraint('');
    setShowTranslationPrompt(false);
    setShowConfirmationPrompt(false);
    setCurrentConstraint(null);
    setManualTranslation('');
    setExistingTranslation(null);
  };

  const handleManualTranslation = () => {
    if (currentConstraint && manualTranslation.trim()) {
      addConstraintToList({
        ...currentConstraint,
        booleanExpression: manualTranslation,
      });
    } else {
      // Add constraint without translation if user skips
      addConstraintToList(currentConstraint);
    }
  };

  const handleConfirmTranslation = (confirmed) => {
    if (confirmed) {
      addConstraintToList({
        ...currentConstraint,
        booleanExpression: existingTranslation,
      });
    } else {
      // If user rejects the existing translation, show manual translation prompt
      setShowConfirmationPrompt(false);
      setShowTranslationPrompt(true);
    }
  };

  return (
    <div className="constraint-manager">
      <h3>Cross-Tree Constraints</h3>
      
      <div className="constraint-input">
        <input
          type="text"
          value={newConstraint}
          onChange={(e) => setNewConstraint(e.target.value)}
          placeholder="Enter constraint in English (e.g., 'Feature A requires Feature B')"
        />
        <button onClick={handleAddConstraint}>Add Constraint</button>
      </div>

      {showConfirmationPrompt && (
        <div className="translation-prompt">
          <p>A translation already exists for this type of constraint:</p>
          <p className="boolean-expression">{existingTranslation}</p>
          <p>Would you like to use this translation?</p>
          <div className="button-group">
            <button onClick={() => handleConfirmTranslation(true)}>Yes, use this</button>
            <button onClick={() => handleConfirmTranslation(false)}>No, translate manually</button>
          </div>
        </div>
      )}

      {showTranslationPrompt && (
        <div className="translation-prompt">
          <p>Please provide the propositional logic translation:</p>
          <input
            type="text"
            value={manualTranslation}
            onChange={(e) => setManualTranslation(e.target.value)}
            placeholder="e.g., (A → B)"
          />
          <div className="button-group">
            <button onClick={handleManualTranslation}>Add Translation</button>
            <button onClick={() => addConstraintToList(currentConstraint)}>Skip Translation</button>
          </div>
        </div>
      )}

      <div className="constraints-list">
        {constraints.map((constraint, index) => (
          <div key={constraint.id || index} className="constraint-item">
            <p>{constraint.englishStatement}</p>
            {constraint.booleanExpression && (
              <p className="boolean-expression">{constraint.booleanExpression}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default ConstraintManager;
