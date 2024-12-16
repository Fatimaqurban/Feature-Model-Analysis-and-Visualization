import React, { useState } from 'react';
import './App.css';
import ConstraintManager from './ConstraintManager';

function App() {
  const [file, setFile] = useState(null);
  const [logicFormula, setLogicFormula] = useState('');
  const [mwpList, setMwpList] = useState([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [pendingTranslations, setPendingTranslations] = useState(false);
  const [temporaryModel, setTemporaryModel] = useState(null);
  const [constraints, setConstraints] = useState([]);
  const [availableFeatures, setAvailableFeatures] = useState([]);
  const [validationErrors, setValidationErrors] = useState([]);
  const [visualizationModel, setVisualizationModel] = useState(null);
  const [xorGroups, setXorGroups] = useState([]);
  const [mandatoryFeatures, setMandatoryFeatures] = useState([]);
  const [dependencies, setDependencies] = useState({});
  const [selectedFeatures, setSelectedFeatures] = useState({});

  const extractFeatures = (model) => {
    const features = [];
    
    const traverse = (node) => {
      if (!node) return;
      
      if (node.name) {
        features.push(node.name);
      }
      
      if (node.children) {
        node.children.forEach(child => {
          if (child.type === 'feature') {
            traverse(child);
          } else if (child.type === 'group') {
            child.children.forEach(groupChild => traverse(groupChild));
          }
        });
      }
    };
    
    traverse(model);
    return features;
  };

  const handleFileChange = (event) => {
    setFile(event.target.files[0]);
    resetState();
  };

  const resetState = () => {
    setErrorMessage('');
    setLogicFormula('');
    setMwpList([]);
    setPendingTranslations(false);
    setTemporaryModel(null);
    setConstraints([]);
    setAvailableFeatures([]);
    setValidationErrors([]);
  };

  const handleFileUpload = () => {
    if (!file) {
      setErrorMessage('Please select a file before uploading.');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    fetch('http://localhost:5000/upload', {
      method: 'POST',
      body: formData,
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.error) {
          setErrorMessage(data.error);
          resetState();
        } else if (data.status === 'needs_translation') {
          // Handle constraints that need translation
          setPendingTranslations(true);
          setTemporaryModel(data.model);
          setConstraints(data.untranslated_constraints);
          setAvailableFeatures(extractFeatures(data.model));
        } else {
          // Handle complete translation
          setLogicFormula(data.logic_formula || 'No formula generated.');
          setMwpList(data.minimum_working_products || []);
          setConstraints(data.constraints || []);
          setPendingTranslations(false);
          setTemporaryModel(null);
          setErrorMessage('');
        }
      })
      .catch((error) => {
        console.error('Error:', error);
        setErrorMessage('An unexpected error occurred. Please try again.');
      });
  };

  const handleTranslationsComplete = () => {
    fetch('http://localhost:5000/complete-translation', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: temporaryModel,
        constraints: constraints,
      }),
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.error) {
          setErrorMessage(data.error);
        } else {
          setLogicFormula(data.logic_formula || 'No formula generated.');
          setMwpList(data.minimum_working_products || []);
          setConstraints(data.constraints || []);
          setPendingTranslations(false);
          setTemporaryModel(null);
          setErrorMessage('');
        }
      })
      .catch((error) => {
        console.error('Error:', error);
        setErrorMessage('An unexpected error occurred while completing translations.');
      });
  };

  const handleFindMwp = () => {
    if (!file) {
      setErrorMessage('Please select a file before finding MWPs.');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    fetch('http://localhost:5000/find_mwp', {
      method: 'POST',
      body: formData,
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.error) {
          setErrorMessage(data.error);
        } else {
          setMwpList(data.minimum_working_products || []);
          setErrorMessage('');
        }
      })
      .catch((error) => {
        console.error('Error:', error);
        setErrorMessage('An unexpected error occurred while finding MWPs.');
      });
  };

  const handleVisualization = () => {
    if (!file) {
      setErrorMessage('Please select a file before visualizing.');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    fetch('http://localhost:5000/visualization', {
      method: 'POST',
      body: formData,
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.error) {
          setErrorMessage(data.error);
        } else {
          setVisualizationModel(data.visualization_model);
          setXorGroups(data.xor_groups || []);
          setMandatoryFeatures(data.mandatory_features || []);
          setDependencies(data.dependencies || {});
          setErrorMessage('');
        }
      })
      .catch((error) => {
        console.error('Error:', error);
        setErrorMessage('An unexpected error occurred while visualizing.');
      });
  };

  const findParent = (featureName, model) => {
    if (!model) return null;

    const searchChildren = (node) => {
      if (!node.children) return null;
      
      for (const child of node.children) {
        if (child.type === 'feature' && child.name === featureName) {
          return node.name;
        }
        if (child.type === 'group') {
          for (const groupChild of child.children) {
            if (groupChild.name === featureName) {
              return node.name;
            }
          }
        }
        const result = searchChildren(child);
        if (result) return result;
      }
      return null;
    };

    return searchChildren(model);
  };

  const findAllChildren = (featureName, model) => {
    const children = [];

    const searchChildren = (node) => {
      if (!node) return;
      
      if (node.name === featureName) {
        const collectChildren = (n) => {
          if (!n.children) return;
          
          for (const child of n.children) {
            if (child.type === 'feature') {
              children.push(child.name);
              collectChildren(child);
            } else if (child.type === 'group') {
              for (const groupChild of child.children) {
                children.push(groupChild.name);
                collectChildren(groupChild);
              }
            }
          }
        };
        collectChildren(node);
        return;
      }

      if (node.children) {
        for (const child of node.children) {
          if (child.type === 'group') {
            for (const groupChild of child.children) {
              searchChildren(groupChild);
            }
          }
          searchChildren(child);
        }
      }
    };

    searchChildren(model);
    return children;
  };

  const findDependentFeatures = (featureName) => {
    const dependentFeatures = [];
    Object.entries(dependencies).forEach(([feature, deps]) => {
      if (deps.includes(featureName)) {
        dependentFeatures.push(feature);
      }
    });
    return dependentFeatures;
  };

  const validateSelections = (selections) => {
    const errors = [];

    // Validate mandatory features
    mandatoryFeatures.forEach(feature => {
      if (!selections[feature]) {
        errors.push(`${feature} is mandatory and must be selected.`);
      }
    });

    // Validate XOR groups
    xorGroups.forEach(group => {
      const selectedCount = group.filter(feature => selections[feature]).length;
      if (selectedCount > 1) {
        errors.push(`Only one feature can be selected from XOR group: ${group.join(', ')}`);
      }
    });

    // Validate dependencies
    Object.entries(dependencies).forEach(([feature, required]) => {
      if (selections[feature] && required.some(req => !selections[req])) {
        errors.push(`${feature} requires ${required.join(' and ')}`);
      }
    });

    setValidationErrors(errors);
  };

  const handleFeatureSelection = (featureName, isSelected) => {
    setSelectedFeatures(prevState => {
      const newSelectedFeatures = { ...prevState };
      
      if (!isSelected && mandatoryFeatures.includes(featureName)) {
        return prevState;
      }

      if (isSelected) {
        newSelectedFeatures[featureName] = true;
        
        const xorGroup = xorGroups.find(group => group.includes(featureName));
        if (xorGroup) {
          xorGroup.forEach(feature => {
            if (feature !== featureName) {
              newSelectedFeatures[feature] = false;
            }
          });
        }

        let currentFeature = featureName;
        while (currentFeature) {
          const parent = findParent(currentFeature, visualizationModel);
          if (parent) {
            newSelectedFeatures[parent] = true;
            currentFeature = parent;
          } else {
            currentFeature = null;
          }
        }
      } else {
        newSelectedFeatures[featureName] = false;
        
        const childFeatures = findAllChildren(featureName, visualizationModel);
        childFeatures.forEach(child => {
          newSelectedFeatures[child] = false;
        });

        const dependentFeatures = findDependentFeatures(featureName);
        dependentFeatures.forEach(feat => {
          newSelectedFeatures[feat] = false;
        });
      }

      validateSelections(newSelectedFeatures);
      return newSelectedFeatures;
    });
  };

  const renderFeatureTree = (node) => {
    if (!node) return null;

    const isSelected = selectedFeatures[node.name] || false;
    const isMandatory = mandatoryFeatures.includes(node.name);
    const isInXorGroup = xorGroups.some(group => group.includes(node.name));
    const isDisabled = 
      (isInXorGroup && 
        xorGroups.some(group => 
          group.includes(node.name) && 
          group.some(feature => selectedFeatures[feature] && feature !== node.name)
      )) || 
      (isMandatory && isSelected);

    return (
      <li className="feature-item">
        <div className={`feature-row ${isMandatory ? 'mandatory' : 'optional'}`}>
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => handleFeatureSelection(node.name, e.target.checked)}
            disabled={isDisabled}
          />
          <span className="feature-label">
            {node.name}
            {isMandatory && <span className="mandatory-marker">*</span>}
            {isInXorGroup && <span className="xor-marker">(XOR)</span>}
          </span>
        </div>
        
        {node.children && node.children.length > 0 && (
          <ul className="feature-children">
            {node.children.map((child, index) => (
              <li key={index} className="child-feature">
                {child.type === 'group' ? (
                  <div className="group-container">
                    <div className="group-type">
                      {child.group_type.toUpperCase()} Group
                    </div>
                    <ul>
                      {child.children.map((groupChild, idx) => (
                        <li key={idx}>
                          {renderFeatureTree(groupChild)}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  renderFeatureTree(child)
                )}
              </li>
            ))}
          </ul>
        )}
      </li>
    );
  };

  return (
    <div className="App">
      <h1>Feature Model XML Parser</h1>
      <div className="input-section">
        <input type="file" onChange={handleFileChange} />
        <button className="upload-button" onClick={handleFileUpload}>
          Upload and Translate
        </button>
        <button className="mwp-button" onClick={handleFindMwp}>
          Find MWPs
        </button>
        <button className="visualize-button" onClick={handleVisualization}>
          Visualize Model
        </button>
      </div>

      {errorMessage && <div className="error-message">{errorMessage}</div>}

      {pendingTranslations && (
        <div className="translation-section">
          <h2>Cross-Tree Constraints Translation</h2>
          <p>Please translate the following constraints before continuing:</p>
          
          <ConstraintManager
            constraints={constraints}
            setConstraints={setConstraints}
            availableFeatures={availableFeatures}
            onValidationError={(error) => setValidationErrors(prev => [...prev, error])}
          />
          
          <button 
            className="complete-translation-button"
            onClick={handleTranslationsComplete}
          >
            Complete Translations and Generate Formula
          </button>
        </div>
      )}

      {logicFormula && (
        <div className="output-section">
          <h2>Propositional Logic Formula:</h2>
          <p>{logicFormula}</p>
        </div>
      )}

      {mwpList.length > 0 && (
        <div className="output-section">
          <h2>Minimum Working Products (MWPs):</h2>
          <ul>
            {mwpList.map((mwp, index) => (
              <li key={index}>{mwp.join(', ')}</li>
            ))}
          </ul>
        </div>
      )}

      {visualizationModel && (
        <>
          <div className="feature-model-wizard">
            <h2>Feature Selection</h2>
            <ul className="wizard-container">
              {renderFeatureTree(visualizationModel)}
            </ul>
            {validationErrors.length > 0 && (
              <div className="validation-errors">
                {validationErrors.map((error, index) => (
                  <div key={index} className="error-message">{error}</div>
                ))}
              </div>
            )}
          </div>
          
          <ConstraintManager
            constraints={constraints}
            setConstraints={setConstraints}
            availableFeatures={availableFeatures}
            onValidationError={(error) => setValidationErrors(prev => [...prev, error])}
          />
        </>
      )}
    </div>
  );
}

export default App;
