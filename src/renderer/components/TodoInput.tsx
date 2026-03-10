import React, { useState, KeyboardEvent } from 'react';
import './TodoInput.css';

interface TodoInputProps {
  onAdd: (title: string) => void;
}

const TodoInput: React.FC<TodoInputProps> = ({ onAdd }) => {
  const [inputValue, setInputValue] = useState('');

  const handleKeyPress = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && inputValue.trim()) {
      onAdd(inputValue);
      setInputValue('');
    }
  };

  return (
    <div className="todo-input-container">
      <input
        type="text"
        className="todo-input"
        placeholder="输入任务，按回车添加..."
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyPress={handleKeyPress}
      />
    </div>
  );
};

export default TodoInput;

