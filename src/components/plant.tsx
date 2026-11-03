export function Plant({ stage = 0, small = false }: { stage?: number; small?: boolean }) {
  return (
    <svg
      className={`garden-plant ${small ? 'small' : ''}`}
      viewBox="0 0 360 300"
      role="img"
      aria-label={
        stage < 1
          ? 'A little sprout, ready to grow'
          : stage < 3
            ? 'A leafy plant growing with your progress'
            : 'A flourishing plant with little blossoms'
      }
    >
      <defs>
        <linearGradient id="leaf" x1="0" y1="1" x2="1" y2="0">
          <stop stopColor="#4e7152" />
          <stop offset="1" stopColor="#96b082" />
        </linearGradient>
        <linearGradient id="pot" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#d9a98c" />
          <stop offset="1" stopColor="#b58063" />
        </linearGradient>
      </defs>
      <circle cx="181" cy="137" r="105" fill="#e8ebd9" opacity=".7" />
      <ellipse cx="180" cy="275" rx="84" ry="12" fill="#b4bea4" opacity=".25" />
      <g className="plant-sway">
        <path
          d="M180 219 Q174 175 183 112"
          stroke="#557754"
          strokeWidth="5"
          fill="none"
          strokeLinecap="round"
        />
        <path d="M180 168C139 176 116 140 125 119C158 115 186 133 180 168Z" fill="url(#leaf)" />
        <path d="M180 146C216 148 243 119 232 94C198 96 178 115 180 146Z" fill="url(#leaf)" />
        <path d="M181 119C155 113 152 85 164 67C188 73 195 97 181 119Z" fill="#6f925e" />
        <path
          d="M178 160L137 131M184 139L221 108"
          stroke="#b2c49c"
          strokeWidth="1.4"
          fill="none"
          opacity=".7"
        />
        {stage >= 1 && (
          <>
            <path d="M178 199C145 207 119 188 119 168C146 158 174 175 178 199Z" fill="#7b9c68" />
            <path d="M179 183C211 193 236 174 237 152C209 146 184 161 179 183Z" fill="url(#leaf)" />
          </>
        )}
        {stage >= 2 && (
          <>
            <path d="M181 124Q215 103 211 71" stroke="#6d8b5b" strokeWidth="3" fill="none" />
            <path d="M211 92C225 86 239 64 228 52C208 55 202 76 211 92Z" fill="#96ac78" />
          </>
        )}
        {stage >= 3 && (
          <g transform="translate(209 58)">
            <circle r="15" fill="#d3bbd7" />
            <circle cx="-9" cy="7" r="10" fill="#d3bbd7" />
            <circle cx="9" cy="7" r="10" fill="#d3bbd7" />
            <circle cy="5" r="6" fill="#f5d98a" />
          </g>
        )}
      </g>
      <path d="M138 222H222L211 267Q180 282 149 267Z" fill="url(#pot)" />
      <rect x="132" y="212" width="96" height="19" rx="7" fill="#ddb598" />
      <ellipse cx="180" cy="213" rx="42" ry="6" fill="#8f6c4c" />
      <path d="M153 235L158 259" stroke="#e8c2a3" strokeWidth="4" strokeLinecap="round" />
      <circle cx="171" cy="244" r="2" fill="#715344" />
      <circle cx="192" cy="244" r="2" fill="#715344" />
      <path
        d="M177 251Q182 256 187 251"
        stroke="#715344"
        strokeWidth="1.8"
        strokeLinecap="round"
        fill="none"
      />
      <g fill="#c7a56c">
        <path d="M84 96l3 7 7 3-7 3-3 7-3-7-7-3 7-3Z" />
        <path d="M264 155l2 5 5 2-5 2-2 5-2-5-5-2 5-2Z" />
      </g>
      <circle cx="266" cy="75" r="3" fill="#b8be96" />
      <circle cx="96" cy="192" r="3" fill="#b8be96" />
    </svg>
  );
}
