function Loading({ message = "Loading..." }) {
  return (
    <div className="min-h-screen bg-bg-dark flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin-slow mx-auto mb-4"></div>
        <p className="text-text-secondary text-sm">{message}</p>
      </div>
    </div>
  );
}

export default Loading;
