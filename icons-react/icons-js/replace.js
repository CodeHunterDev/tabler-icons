import * as React from "react";

const IconReplace = (size = 24, color = "currentColor", stroke = 2, ...props) => <svg className="icon icon-tabler icon-tabler-replace" width={size} height={size} viewBox="0 0 24 24" strokeWidth={stroke} stroke={color} fill="none" strokeLinecap="round" strokeLinejoin="round" {...props}><rect x={3} y={3} width={6} height={6} rx={1} /><rect x={15} y={15} width={6} height={6} rx={1} /><path d="M21 11v-3a2 2 0 0 0 -2 -2h-6l3 3m0 -6l-3 3" /><path d="M3 13v3a2 2 0 0 0 2 2h6l-3 -3m0 6l3 -3" /></svg>;

export default IconReplace;