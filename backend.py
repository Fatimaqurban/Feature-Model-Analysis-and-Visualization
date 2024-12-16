from flask import Flask, request, jsonify
from flask_cors import CORS
from lxml import etree  # Importing XML parsing library
from pysat.solvers import Glucose3  # Import the SAT solver

app = Flask(__name__)
CORS(app)

def parse_xml_to_model(element):
    """Parses XML elements into a structured internal model."""
    if element.tag == 'feature':
        print(f"Parsing feature '{element.get('name')}'")
        return parse_feature(element)
    
    elif element.tag == 'featureModel':
        print(f"Parsing 'featureModel' wrapper...")
        model = None
        constraints = []
        
        # Parse root-level constraints
        constraints_elem = element.find('constraints')
        if constraints_elem is not None:
            for constraint in constraints_elem.findall('constraint'):
                constraint_info = {
                    'id': constraint.get('id', str(len(constraints))),
                    'type': 'unknown'
                }
                
                english_statement = constraint.find('englishStatement')
                boolean_expression = constraint.find('booleanExpression')
                
                if english_statement is not None:
                    constraint_info['englishStatement'] = english_statement.text
                    # Try to translate the English statement
                    translation = translate_english_to_logic(english_statement.text)
                    if translation:
                        constraint_info['booleanExpression'] = translation
                        constraint_info['type'] = 'requires' if '→' in translation else 'excludes'
                
                if boolean_expression is not None:
                    constraint_info['booleanExpression'] = boolean_expression.text
                else:
                    # Try to generate boolean expression from English statement
                    try:
                        translation = translate_english_to_logic(constraint_info['englishStatement'])
                        if translation:
                            constraint_info['booleanExpression'] = translation
                    except:
                        pass
                
                constraints.append(constraint_info)
        
        # Find and parse the root feature
        for child in element:
            if child.tag == 'feature':
                model = parse_xml_to_model(child)
                if model:
                    model['constraints'] = constraints
                break
        
        return model

def parse_feature(element):
    """Parse the feature element and its children."""
    name = element.get('name')
    if name is None:
        print(f"Error: Feature does not have a 'name' attribute! Element: {etree.tostring(element, pretty_print=True)}")
        return None
    
    mandatory = element.get('mandatory', 'false') == 'true'
    group_type = None

    print(f"\nParsing feature '{name}' (Mandatory: {mandatory})")

    model = {
        'name': name,
        'mandatory': mandatory,
        'children': [],
        'type': 'feature',
        'group_type': group_type,
        'constraints': []
    }

    for child in element:
        if child.tag == 'feature':
            print(f"├── Found direct child feature '{child.get('name')}' for feature '{name}', parsing...")
            child_model = parse_feature(child)
            if child_model:
                model['children'].append(child_model)

        elif child.tag == 'group':
            group_type = child.get('type', 'or').lower()
            print(f"├── Found {group_type} group for feature '{name}', parsing group children...")
            
            group_features = []
            for group_child in child:
                if group_child.tag == 'feature':
                    child_name = group_child.get('name')
                    if child_name:
                        print(f"│   ├── Found group child feature '{child_name}'")
                        child_model = parse_feature(group_child)
                        if child_model:
                            group_features.append(child_model)

            if group_features:
                model['children'].append({
                    'type': 'group',
                    'group_type': group_type,
                    'children': group_features
                })

    return model

def translate_english_to_logic(english_statement):
    """Translate English constraint to propositional logic."""
    english_statement = english_statement.lower()
    
    # Handle "if ... must be selected" pattern
    if "if" in english_statement and "must be selected" in english_statement:
        parts = english_statement.split(",")
        if len(parts) == 2:
            condition = parts[0].replace("if", "").replace("is selected", "").strip()
            feature_b = parts[1].replace("must be selected", "").strip().strip('.')
            return f"{condition} → {feature_b}"
    
    # Handle "if ... is selected, ... cannot be selected" pattern
    if "if" in english_statement and "is selected" in english_statement and "cannot be selected" in english_statement:
        parts = english_statement.split(",")
        if len(parts) == 2:
            feature_a = parts[0].replace("if", "").replace("is selected", "").strip()
            feature_b = parts[1].replace("cannot be selected", "").strip().strip('.')
            return f"~({feature_a} ∧ {feature_b})"
    
    # Handle "is required to" pattern
    if "is required to" in english_statement:
        parts = english_statement.split("is required to")
        if len(parts) == 2:
            feature_a = parts[0].strip().replace("the ", "")
            feature_b = parts[1].strip()
            
            if "filter the catalog by location" in feature_b:
                return f"{feature_a} → ByLocation"
            
            return f"{feature_a} → {feature_b}"
    
    # Handle standard "requires" pattern
    if "requires" in english_statement:
        words = english_statement.split()
        feature_a = words[words.index("requires") - 1]
        feature_b = words[words.index("requires") + 1]
        return f"{feature_a} → {feature_b}"
    
    # Handle "implies" pattern
    if "implies" in english_statement:
        words = english_statement.split()
        feature_a = words[words.index("implies") - 1]
        feature_b = words[words.index("implies") + 1]
        return f"{feature_a} → {feature_b}"
    
    # Handle "excludes" pattern
    if "excludes" in english_statement:
        words = english_statement.split()
        feature_a = words[words.index("excludes") - 1]
        feature_b = words[words.index("excludes") + 1]
        return f"~({feature_a} ∧ {feature_b})"
    
    return None

def generate_propositional_logic(model):
    """Translate feature model to propositional logic."""
    formulas = []
    formulas.append(model['name'])
    
    def process_feature(feature, parent_name=None):
        if parent_name and feature.get('mandatory', False):
            formulas.append(f"({feature['name']} → {parent_name})")
            formulas.append(f"({parent_name} → {feature['name']})")
        
        elif parent_name and not feature.get('mandatory', False):
            formulas.append(f"({parent_name} ↔ ({feature['name']} ∨ ~{feature['name']}))")
        
        for child in feature['children']:
            if child['type'] == 'feature':
                process_feature(child, feature['name'])
            elif child['type'] == 'group':
                process_group(child, feature['name'])
    
    def process_group(group, parent_name):
        children_names = [child['name'] for child in group['children']]
        if group['group_type'] == 'or':
            or_clause = ' ∨ '.join(children_names)
            formulas.append(f"({parent_name} → ({or_clause}))")
            for child_name in children_names:
                formulas.append(f"({child_name} → {parent_name})")
        
        elif group['group_type'] == 'xor':
            xor_clauses = []
            for i, selected in enumerate(children_names):
                others = children_names[:i] + children_names[i+1:]
                clause = f"({selected} ∧ {' ∧ '.join(f'~{other}' for other in others)})"
                xor_clauses.append(clause)
            formulas.append(f"({parent_name} → ({' ∨ '.join(xor_clauses)}))")
            for child_name in children_names:
                formulas.append(f"({child_name} → {parent_name})")
    
    # Process feature tree structure
    process_feature(model)
    
    # Process cross-tree constraints
    if 'constraints' in model:
        for constraint in model['constraints']:
            if not constraint.get('booleanExpression'):
                # Try to translate English statement if no boolean expression exists
                translation = translate_english_to_logic(constraint['englishStatement'])
                if translation:
                    constraint['booleanExpression'] = translation
            
            if constraint.get('booleanExpression'):
                formulas.append(f"({constraint['booleanExpression']})")
    
    return ' ∧ '.join(formulas)

def find_minimum_working_products(model):
    """
    Find all minimum working products (MWPs) - minimal valid feature configurations 
    that satisfy mandatory features and cross-tree constraints while minimizing optional features.
    """
    def get_all_features(model):
        """Extract all feature names from the model"""
        features = set()

        def traverse(node):
            if node['type'] == 'feature':
                features.add(node['name'])
                for child in node['children']:
                    if child['type'] == 'feature':
                        traverse(child)
                    elif child['type'] == 'group':
                        for group_child in child['children']:
                            traverse(group_child)

        traverse(model)
        return features

    def create_cnf_clauses(model, all_features):
        """Convert feature model to CNF clauses with variable mapping"""
        clauses = []
        feature_to_var = {feature: i + 1 for i, feature in enumerate(sorted(all_features))}
        var_to_feature = {v: k for k, v in feature_to_var.items()}

        # Root feature must be selected
        clauses.append([feature_to_var[model['name']]])

        def process_node(node, parent_var=None):
            if node['type'] == 'feature':
                current_var = feature_to_var[node['name']]

                # Handle mandatory features
                if parent_var and node.get('mandatory', False):
                    clauses.append([-parent_var, current_var])  # parent → child
                    clauses.append([-current_var, parent_var])  # child → parent

                # Handle optional features
                elif parent_var:
                    clauses.append([-current_var, parent_var])  # child → parent

                # Process children
                for child in node['children']:
                    if child['type'] == 'feature':
                        process_node(child, current_var)
                    elif child['type'] == 'group':
                        process_group(child, current_var)

        def process_group(group, parent_var):
            children_vars = [feature_to_var[child['name']] for child in group['children']]

            # OR group
            if group['group_type'] == 'or':
                # parent → (child1 ∨ child2 ∨ ...)
                clauses.append([-parent_var] + children_vars)
                # Each child → parent
                for child_var in children_vars:
                    clauses.append([-child_var, parent_var])

            # XOR group
            elif group['group_type'] == 'xor':
                # At least one must be selected
                clauses.append([-parent_var] + children_vars)
                # At most one can be selected
                for i in range(len(children_vars)):
                    for j in range(i + 1, len(children_vars)):
                        clauses.append([-children_vars[i], -children_vars[j]])
                # Each child → parent
                for child_var in children_vars:
                    clauses.append([-child_var, parent_var])

        # Process the entire model
        process_node(model)
        return clauses, feature_to_var, var_to_feature

    # Get all features
    all_features = get_all_features(model)

    # Create CNF clauses
    cnf_clauses, feature_to_var, var_to_feature = create_cnf_clauses(model, all_features)

    # Create SAT solver
    solver = Glucose3()
    solver.append_formula(cnf_clauses)

    # Find all solutions
    solutions = []
    while solver.solve():
        model = solver.get_model()
        if model:
            # Convert to feature names
            solution = set()
            for lit in model:
                if lit > 0:
                    feature = var_to_feature[lit]
                    solution.add(feature)

            # Check if solution is minimal
            is_minimal = True
            for existing_sol in solutions:
                if existing_sol.issubset(solution):
                    is_minimal = False
                    break

            if is_minimal:
                # Remove any existing solutions that are supersets
                solutions = [s for s in solutions if not solution.issubset(s)]
                solutions.append(solution)

            # Add blocking clause
            solver.add_clause([-lit for lit in model])

    # Convert solutions to sorted lists for consistent output
    return [sorted(list(sol)) for sol in solutions]

def prepare_visualization_model(model):
    """Prepare the feature model for visualization as a checkbox tree with added data for interaction."""
    def process_feature_for_visualization(feature):
        node = {
            'name': feature['name'],
            'mandatory': feature['mandatory'],
            'type': feature['type'],
            'children': [],
            'constraints': feature['constraints'] if 'constraints' in feature else [],
            'group_type': feature.get('group_type', None),  # For group features, capture group type (OR/XOR)
        }

        for child in feature['children']:
            if child['type'] == 'feature':
                node['children'].append(process_feature_for_visualization(child))
            elif child['type'] == 'group':
                group_node = {
                    'type': 'group',
                    'group_type': child['group_type'],
                    'children': []
                }
                for group_child in child['children']:
                    group_node['children'].append(process_feature_for_visualization(group_child))
                node['children'].append(group_node)
        
        return node

    return process_feature_for_visualization(model)

@app.route('/visualization', methods=['POST'])
def feature_model_visualization():
    """Provide the hierarchical model structure for visualization."""
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    
    try:
        xml_root = etree.parse(file.stream)
        parsed_model = parse_xml_to_model(xml_root.getroot())
        visualization_model = prepare_visualization_model(parsed_model)
        
        # Extract XOR groups and mandatory features
        xor_groups = []
        mandatory_features = []
        dependencies = {}

        def extract_model_metadata(node):
            if node['type'] == 'feature':
                if node['mandatory']:
                    mandatory_features.append(node['name'])
                
                # Extract dependencies
                if 'requires' in node:
                    dependencies[node['name']] = node['requires']
                
                for child in node['children']:
                    if child['type'] == 'group' and child['group_type'] == 'xor':
                        xor_group = [feature['name'] for feature in child['children']]
                        xor_groups.append(xor_group)
                    extract_model_metadata(child)
            elif node['type'] == 'group':
                for child in node['children']:
                    extract_model_metadata(child)

        extract_model_metadata(visualization_model)

        return jsonify({
            'visualization_model': visualization_model,
            'xor_groups': xor_groups,
            'mandatory_features': mandatory_features,
            'dependencies': dependencies
        }), 200
    except Exception as e:
        return jsonify({'error': f"Unexpected Error: {str(e)}"}), 500

@app.route('/find_mwp', methods=['POST'])
def find_mwp():
    """Calculate minimum working products (MWPs) from the uploaded XML."""
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    
    try:
        xml_root = etree.parse(file.stream)
        parsed_model = parse_xml_to_model(xml_root.getroot())
        
        # First handle cross-tree constraints
        if 'constraints' in parsed_model:
            for constraint in parsed_model['constraints']:
                if not constraint.get('booleanExpression'):
                    translation = translate_english_to_logic(constraint['englishStatement'])
                    if translation:
                        constraint['booleanExpression'] = translation
                        
        # Find MWPs
        mwps = find_minimum_working_products(parsed_model)

        return jsonify({
            'minimum_working_products': mwps,
            'constraints': parsed_model.get('constraints', [])
        }), 200
    except Exception as e:
        return jsonify({'error': f"Unexpected Error: {str(e)}"}), 500

@app.route('/upload', methods=['POST'])
def upload_file():
    """Handle file upload, parse XML, and compute results."""
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    
    try:
        xml_root = etree.parse(file.stream)
        parsed_model = parse_xml_to_model(xml_root.getroot())
        
        # First handle cross-tree constraints
        if 'constraints' in parsed_model:
            for constraint in parsed_model['constraints']:
                if not constraint.get('booleanExpression'):
                    translation = translate_english_to_logic(constraint['englishStatement'])
                    if translation:
                        constraint['booleanExpression'] = translation
        
        # Then generate the complete propositional logic formula
        logic_formula = generate_propositional_logic(parsed_model)

        return jsonify({
            'logic_formula': logic_formula,
            'constraints': parsed_model.get('constraints', [])
        }), 200
    except Exception as e:
        return jsonify({'error': f"Unexpected Error: {str(e)}"}), 500

if __name__ == '__main__':
    app.run(debug=True)
    