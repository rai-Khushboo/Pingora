import React from 'react';

const Input = ({
  label = '',
  name = '',
  type = 'text',
  className = '',
  inputClassName = '',
  isRequired = true,
  placeholder = '',
  value = '',
  onChange = () => {},
  onKeyDown = () => {},
}) => {
  return (
    <div className={`${className}`}>
      <label
        htmlFor={name}
        className="block mb-2 text-sm font-medium text-gray-300"
      >
        {label}
      </label>
      <div className="relative">
        <input
          type={type}
          id={name}
          className={`w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm 
            focus:ring-2 focus:ring-indigo-400 focus:border-indigo-500 outline-none transition-all duration-200
            placeholder:text-slate-400 ${inputClassName}`}
          placeholder={placeholder}
          required={isRequired}
          value={value}
          onChange={onChange}
          onKeyDown={onKeyDown}
        />
      </div>
    </div>
  );
};

export default Input;
