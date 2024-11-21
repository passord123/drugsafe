const Progress = ({ value }) => (
    <div className="w-full bg-gray-200 rounded-full h-2.5">
      <div 
        className="bg-blue-500 h-2.5 rounded-full transition-all duration-300" 
        style={{ width: `${value}%` }}
      />
    </div>
  );

  export default Progress