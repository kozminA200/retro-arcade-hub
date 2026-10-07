class Board {
    constructor(ctx) {
        this.ctx = ctx;
        this.grid = this.getEmptyGrid();
    }

    getEmptyGrid() {
        return Array.from({ length: ROWS }, () => Array(COLS).fill(0));
    }

    isValid(piece, pX = piece.x, pY = piece.y) {
        return piece.shape.every((row, dy) => {
            return row.every((value, dx) => {
                let x = pX + dx;
                let y = pY + dy;
                return (
                    value === 0 || 
                    (this.isInsideWalls(x) && this.isAboveFloor(y) && this.notOccupied(x, y))
                );
            });
        });
    }

    isInsideWalls(x) { return x >= 0 && x < COLS; }
    isAboveFloor(y) { return y < ROWS; }
    notOccupied(x, y) { return this.grid[y] && this.grid[y][x] === 0; }

    clearLines() {
        let linesCleared = 0;
        for (let y = ROWS - 1; y >= 0; y--) {
            if (this.grid[y].every(value => value !== 0)) {
                this.grid.splice(y, 1);
                this.grid.unshift(Array(COLS).fill(0));
                linesCleared++;
                y++; 
            }
        }
        return linesCleared;
    }
}