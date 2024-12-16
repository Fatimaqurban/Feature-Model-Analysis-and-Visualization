# Feature Model Analysis Tool

A web-based tool for analyzing and visualizing feature models, built with Flask and Python. This tool helps software engineers and product line managers analyze feature models, find minimum working products (MWPs), and validate feature configurations.

## Features

- **XML Feature Model Parsing**: Upload and parse XML-based feature model specifications
- **Feature Model Visualization**: Interactive visualization of feature models as checkbox trees
- **Propositional Logic Translation**: Converts feature models into propositional logic formulas
- **Minimum Working Products (MWP)**: Identifies minimal valid feature configurations
- **Cross-tree Constraint Analysis**: Handles and validates cross-tree constraints
- **Natural Language Processing**: Translates English constraints to logical expressions

## Technologies Used

- **Backend**: Python, Flask
- **XML Processing**: lxml
- **SAT Solving**: pysat (Glucose3)
- **Cross-Origin Support**: Flask-CORS

## Installation

1. Clone the repository:
   ```
   git clone https://github.com/Fatimaqurban/Feature-Model-Analysis-and-Visualization.git
   ```

2. Install required dependencies:
   ```
   pip install flask flask-cors lxml python-sat
   ```

3. Run the application:
   ```
   python backend.py
   ```
4. Navigate to the frontend directory:
   ```
   cd frontend
   ```
5. Install the frontend dependencies:
   ```
   npm install
   ```
6. Run the frontend application:
   ```
   npm start
   ```

## API Endpoints

### `/upload` (POST)
- Uploads and processes feature model XML files
- Returns propositional logic formulas and constraints

### `/visualization` (POST)
- Generates visualization data for feature models
- Returns hierarchical structure with metadata

### `/find_mwp` (POST)
- Calculates minimum working products
- Returns valid feature configurations

## Input Format

The tool accepts XML feature models with the following structure:

```xml
<featureModel>
    <feature name="RootFeature">
        <!-- Child features -->
        <feature name="ChildFeature" mandatory="true/false"/>
        <group type="or/xor">
            <!-- Group features -->
        </group>
    </feature>
    <constraints>
        <!-- Cross-tree constraints -->
    </constraints>
</featureModel>
```

## Feature Model Constraints

Supports various constraint types:
- Requires relationships
- Excludes relationships
- Custom logical expressions
- Natural language constraints

