import React, { useState, useEffect } from 'react';
import './App.css';
import TodoList from './components/TodoList';
import TodoInput from './components/TodoInput';
import WindowControls from './components/WindowControls';
import { Todo } from './types/todo';

function App() {
  const [todos, setTodos] = useState<Todo[]>(() => {
    try {
      const saved = localStorage.getItem('todos');
      return saved ? JSON.parse(saved) : [];
    } catch (error) {
      console.warn('Failed to load todos from localStorage:', error);
      return [];
    }
  });
  const [isPinned, setIsPinned] = useState(true);

  // 保存到本地存储
  useEffect(() => {
    try {
      localStorage.setItem('todos', JSON.stringify(todos));
    } catch (error) {
      console.warn('Failed to save todos to localStorage:', error);
    }
  }, [todos]);

  // 监听本地存储变化（实现多窗口同步）
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'todos') {
        try {
          const newTodos = e.newValue ? JSON.parse(e.newValue) : [];
          setTodos(newTodos);
        } catch (error) {
          console.warn('Failed to parse todos from storage event:', error);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  // 应用置顶状态
  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.setAlwaysOnTop(isPinned).catch((err: Error) => {
        console.warn('Failed to set always on top:', err);
      });
    }
  }, [isPinned]);

  const addTodo = (title: string) => {
    if (title.trim()) {
      const newTodo: Todo = {
        id: Date.now().toString(),
        title: title.trim(),
        completed: false,
        createdAt: Date.now(),
      };
      setTodos([...todos, newTodo]);
      try {
        window.dispatchEvent(
          new CustomEvent('app:toast', { detail: { message: '添加成功' } })
        );
      } catch {}
    }
  };

  // 获取今日任务（包括已完成和未完成）
  const getTodayTodos = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStart = today.getTime();
    const todayEnd = todayStart + 24 * 60 * 60 * 1000;

    return todos.filter((todo) => {
      if (!todo.dueDate) return false;
      return todo.dueDate >= todayStart && todo.dueDate < todayEnd;
    });
  };

  const toggleTodo = (id: string) => {
    setTodos(
      todos.map((todo: Todo) =>
        todo.id === id ? { ...todo, completed: !todo.completed } : todo
      )
    );
  };

  const deleteTodo = (id: string) => {
    setTodos(todos.filter((todo) => todo.id !== id));
  };

  const [toastMsg, setToastMsg] = useState<string>('');
  const [toastVisible, setToastVisible] = useState(false);
  useEffect(() => {
    const onToast = (e: any) => {
      const msg = e?.detail?.message || '';
      if (!msg) return;
      setToastMsg(msg);
      setToastVisible(true);
      setTimeout(() => setToastVisible(false), 1800);
    };
    window.addEventListener('app:toast', onToast as EventListener);
    return () => window.removeEventListener('app:toast', onToast as EventListener);
  }, []);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 1800);
  };

  return (
    <div className="app">
      <WindowControls
        isPinned={isPinned}
        onTogglePin={() => setIsPinned(!isPinned)}
      />
      <div className="app-content">
        <h1 className="app-title">小金助手</h1>
        <TodoList
          todos={getTodayTodos()}
          onToggle={toggleTodo}
          onDelete={deleteTodo}
        />
      </div>
      {toastVisible && <div className="app-toast">{toastMsg}</div>}
    </div>
  );
}

export default App;

