const Button = ({
    label = 'Submit',
    type = 'button',
    className = '',
    isDisabled = false,
}) => {
    return (
        <button
            type={type}
            className={`w-full text-white bg-gradient-to-r from-indigo-500 to-blue-500 
                hover:from-indigo-600 hover:to-blue-600 focus:ring-4 focus:ring-indigo-200 
                focus:outline-none font-medium rounded-lg text-sm px-5 py-2.5 text-center 
                transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed
                shadow-sm hover:shadow-md ${className}`}
            disabled={isDisabled}
        >
            {label}
        </button>
    );
};

export default Button;