"""
Sample Python module for DiagramMender demonstration.

This module contains example functions and classes to test
code analysis and diagram generation capabilities.
"""


def calculate_difference(first_value, second_value):
    """
    Calculate the absolute difference between two values.
    
    Args:
        first_value (int): First numeric value
        second_value (int): Second numeric value
        
    Returns:
        int: Absolute difference plus cumulative sum
    """
    if first_value > second_value:
        difference = first_value - second_value
    else:
        difference = second_value - first_value
    
    # Add cumulative sum for demonstration
    for iteration in range(3):
        difference += iteration
        
    return difference


class Calculator:
    """
    Simple calculator class demonstrating basic operations.
    """
    
    def add(self, operand_a, operand_b):
        """
        Add two numbers together.
        
        Args:
            operand_a (float): First operand
            operand_b (float): Second operand
            
        Returns:
            float: Sum of the operands
        """
        return operand_a + operand_b
    
    def multiply(self, operand_a, operand_b):
        """
        Multiply two numbers.
        
        Args:
            operand_a (float): First operand
            operand_b (float): Second operand
            
        Returns:
            float: Product of the operands
        """
        return operand_a * operand_b


def main_execution_flow():
    """
    Main function demonstrating the execution flow.
    
    This function calls other functions and classes to create
    a more complex call graph for analysis.
    """
    # Calculate difference between two values
    result = calculate_difference(10, 5)
    
    # Create calculator instance and perform operations
    calculator = Calculator()
    sum_result = calculator.add(result, 15)
    product_result = calculator.multiply(sum_result, 2)
    
    # Display results
    print(f"Difference calculation result: {result}")
    print(f"Addition result: {sum_result}")
    print(f"Multiplication result: {product_result}")
    
    return product_result


if __name__ == "__main__":
    main_execution_flow()
