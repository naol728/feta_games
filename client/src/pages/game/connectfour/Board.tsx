
type BoardProps = {
  board: number[][]
  hoverCol: number | null
  setHoverCol: (col: number | null) => void
  onColumnClick: (col: number) => void
  disabled: boolean
  myValue: 1 | 2 | null
}

function isTopEmpty(board: number[][], row: number, col: number): boolean {
  for (let r = 5; r >= 0; r--) {
    if (board[r][col] === 0) {
      return r === row
    }
  }
  return false
}
export default function Board({ board, hoverCol, setHoverCol, onColumnClick, disabled, myValue }: BoardProps) {
  return (
    <div className="w-full flex justify-center">
      <div className="grid grid-cols-7 gap-1 bg-blue-900 p-2 rounded-xl touch-manipulation">
        {board.map((row, rIndex) =>
          row.map((cell, cIndex) => {
            let color = "bg-white"
            if (cell === 1) color = "bg-red-500"
            if (cell === 2) color = "bg-yellow-400"

            if (hoverCol === cIndex && cell === 0 && isTopEmpty(board, rIndex, cIndex)) {
              color = myValue === 1 ? "bg-red-300" : "bg-yellow-200"
            }

            return (
              <div
                key={`${rIndex}-${cIndex}`}
                onMouseEnter={() => setHoverCol(cIndex)}
                onMouseLeave={() => setHoverCol(null)}
                onClick={() => !disabled && onColumnClick(cIndex)}
                className={`
                  w-9 h-9 sm:w-12 sm:h-12
                  rounded-full border-2 border-gray-800
                  ${color}
                  ${disabled ? "opacity-70" : "cursor-pointer active:scale-95"}
                  transition-all duration-150
                `}
              />
            )
          })
        )}
      </div>
    </div>
  )
}