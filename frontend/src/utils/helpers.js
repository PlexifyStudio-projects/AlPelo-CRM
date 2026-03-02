export const classNames = (...classes) => classes.filter(Boolean).join(' ');

export const debounce = (fn, delay = 300) => {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
};

export const generateId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
