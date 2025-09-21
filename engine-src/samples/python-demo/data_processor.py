"""
Data processing module demonstrating inheritance and error handling.

This module shows advanced Python patterns including:
- Abstract base classes
- Exception handling
- Property decorators
- Context managers
"""

from abc import ABC, abstractmethod
from typing import List, Optional, Any
import logging


class ProcessorError(Exception):
    """Custom exception for data processing errors."""
    pass


class BaseProcessor(ABC):
    """
    Abstract base class for data processors.
    
    Defines the interface that all processors must implement.
    """
    
    def __init__(self, name: str):
        """
        Initialize the processor.
        
        Args:
            name: Processor instance name
        """
        self._name = name
        self._processed_count = 0
        
    @property
    def name(self) -> str:
        """Get the processor name."""
        return self._name
    
    @property
    def processed_count(self) -> int:
        """Get the count of processed items."""
        return self._processed_count
    
    @abstractmethod
    def process_item(self, item: Any) -> Any:
        """
        Process a single data item.
        
        Args:
            item: Item to process
            
        Returns:
            Processed item
            
        Raises:
            ProcessorError: If processing fails
        """
        pass
    
    def process_batch(self, items: List[Any]) -> List[Any]:
        """
        Process a batch of items with error handling.
        
        Args:
            items: List of items to process
            
        Returns:
            List of processed items
        """
        results = []
        
        for item in items:
            try:
                processed_item = self.process_item(item)
                results.append(processed_item)
                self._processed_count += 1
            except ProcessorError as error:
                logging.error(f"Failed to process item {item}: {error}")
                # Skip failed items and continue
                continue
            except Exception as unexpected_error:
                logging.error(f"Unexpected error processing {item}: {unexpected_error}")
                raise ProcessorError(f"Unexpected processing error") from unexpected_error
                
        return results


class NumberProcessor(BaseProcessor):
    """
    Concrete processor for numeric data.
    
    Processes numbers by applying mathematical operations.
    """
    
    def __init__(self, name: str, multiplier: float = 1.0):
        """
        Initialize number processor.
        
        Args:
            name: Processor name
            multiplier: Value to multiply each number by
        """
        super().__init__(name)
        self._multiplier = multiplier
        
    def process_item(self, item: Any) -> float:
        """
        Process a numeric item.
        
        Args:
            item: Numeric item to process
            
        Returns:
            Processed number
            
        Raises:
            ProcessorError: If item is not numeric
        """
        try:
            numeric_value = float(item)
            return numeric_value * self._multiplier
        except (ValueError, TypeError) as conversion_error:
            raise ProcessorError(f"Cannot convert {item} to number") from conversion_error


class TextProcessor(BaseProcessor):
    """
    Concrete processor for text data.
    
    Processes strings by applying text transformations.
    """
    
    def __init__(self, name: str, to_uppercase: bool = False):
        """
        Initialize text processor.
        
        Args:
            name: Processor name
            to_uppercase: Whether to convert text to uppercase
        """
        super().__init__(name)
        self._to_uppercase = to_uppercase
        
    def process_item(self, item: Any) -> str:
        """
        Process a text item.
        
        Args:
            item: Text item to process
            
        Returns:
            Processed text
            
        Raises:
            ProcessorError: If item cannot be converted to string
        """
        try:
            text_value = str(item)
            
            if self._to_uppercase:
                return text_value.upper()
            else:
                return text_value.lower()
                
        except Exception as conversion_error:
            raise ProcessorError(f"Cannot convert {item} to text") from conversion_error


def create_processor_pipeline(processor_configs: List[dict]) -> List[BaseProcessor]:
    """
    Factory function to create a pipeline of processors.
    
    Args:
        processor_configs: List of processor configuration dictionaries
        
    Returns:
        List of configured processors
        
    Raises:
        ValueError: If configuration is invalid
    """
    processors = []
    
    for config in processor_configs:
        processor_type = config.get('type')
        processor_name = config.get('name', f'processor_{len(processors)}')
        
        if processor_type == 'number':
            multiplier = config.get('multiplier', 1.0)
            processor = NumberProcessor(processor_name, multiplier)
        elif processor_type == 'text':
            to_uppercase = config.get('to_uppercase', False)
            processor = TextProcessor(processor_name, to_uppercase)
        else:
            raise ValueError(f"Unknown processor type: {processor_type}")
            
        processors.append(processor)
        
    return processors


def run_processing_pipeline(data: List[Any], processors: List[BaseProcessor]) -> List[Any]:
    """
    Run data through a pipeline of processors.
    
    Args:
        data: Input data to process
        processors: List of processors to apply
        
    Returns:
        Final processed data
    """
    current_data = data
    
    for processor in processors:
        logging.info(f"Processing with {processor.name}")
        current_data = processor.process_batch(current_data)
        logging.info(f"Processed {processor.processed_count} items")
        
    return current_data


def demonstrate_processing():
    """
    Demonstration function showing the processing pipeline in action.
    """
    # Configure logging
    logging.basicConfig(level=logging.INFO)
    
    # Sample data
    sample_data = [1, 2, 'hello', 4.5, 'world', 6]
    
    # Create processors
    processor_configs = [
        {'type': 'number', 'name': 'multiplier', 'multiplier': 2.0},
        {'type': 'text', 'name': 'uppercaser', 'to_uppercase': True}
    ]
    
    try:
        processors = create_processor_pipeline(processor_configs)
        
        # Process data with number processor
        number_processor = processors[0]
        numeric_data = [x for x in sample_data if isinstance(x, (int, float))]
        processed_numbers = number_processor.process_batch(numeric_data)
        
        # Process data with text processor  
        text_processor = processors[1]
        text_data = [x for x in sample_data if isinstance(x, str)]
        processed_text = text_processor.process_batch(text_data)
        
        print("Processing results:")
        print(f"Numbers: {processed_numbers}")
        print(f"Text: {processed_text}")
        
    except Exception as error:
        logging.error(f"Processing demonstration failed: {error}")
        raise


if __name__ == "__main__":
    demonstrate_processing()
