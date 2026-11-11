import { useRef } from "react";
import { FileText } from "lucide-react";
import { buildLatexResume } from "../utils/latexResume";

// Submits a hidden form directly to Overleaf's documented "Open in Overleaf"
// endpoint (the `snip` field accepts raw LaTeX content — no file hosting or
// backend involvement needed). Overleaf compiles it on their own servers.
function OpenInOverleafButton({ resume, className = "" }) {
  const formRef = useRef(null);

  const handleClick = () => {
    formRef.current?.submit();
  };

  return (
    <>
      <form ref={formRef} action="https://www.overleaf.com/docs" method="post" target="_blank" style={{ display: "none" }}>
        <input type="hidden" name="snip" value={buildLatexResume(resume)} />
        <input type="hidden" name="snip_name[]" value="main.tex" />
        <input type="hidden" name="engine" value="pdflatex" />
      </form>
      <button
        type="button"
        onClick={handleClick}
        title="Opens a new Overleaf project pre-filled with a LaTeX version of this resume"
        className={`px-5 py-2 rounded-xl bg-[#138A07] text-white font-semibold btn-glow text-sm flex items-center gap-2 ${className}`}
      >
        <FileText className="w-4 h-4" /> Open in Overleaf
      </button>
    </>
  );
}

export default OpenInOverleafButton;
