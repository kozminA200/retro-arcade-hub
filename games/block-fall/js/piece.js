class Piece {
    constructor(ctx) {
        this.ctx = ctx;
        // Если игра только началась, генерируем "следующую" фигуру
        if (Piece.nextTypeId == null) {
            Piece.nextTypeId = this.randomizeTetrominoType();
        }
        this.spawn();
    }

    spawn() {
        // Текущая фигура берет тип из "следующей"
        this.typeId = Piece.nextTypeId;
        // А "следующая" сразу генерируется заново
        Piece.nextTypeId = this.randomizeTetrominoType();
        
        this.shape = SHAPES[this.typeId];
        this.color = COLORS[this.typeId];
        
        this.x = 3;
        this.y = 0;
        this.rotationIndex = 0; 
    }

    randomizeTetrominoType() {
        if (!Piece.bag || Piece.bag.length === 0) {
            Piece.bag = [1, 2, 3, 4, 5, 6, 7];
            for (let i = Piece.bag.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [Piece.bag[i], Piece.bag[j]] = [Piece.bag[j], Piece.bag[i]];
            }
        }
        return Piece.bag.pop();
    }

    rotate(board) {
        const oldShape = this.shape;
        this.shape = this.shape[0].map((val, index) => 
            this.shape.map(row => row[index]).reverse()
        );

        if (this.typeId === 4) return; // Квадрат не крутим

        const nextRotationIndex = (this.rotationIndex + 1) % 4;
        const kickKey = `${this.rotationIndex}->${nextRotationIndex}`;
        const kicks = (this.typeId === 1) ? WALL_KICKS_I[kickKey] : WALL_KICKS[kickKey];

        let rotated = false;
        for (let i = 0; i < kicks.length; i++) {
            const [dx, dy] = kicks[i];
            if (board.isValid(this, this.x + dx, this.y + dy)) {
                this.x += dx;
                this.y += dy;
                this.rotationIndex = nextRotationIndex;
                rotated = true;
                break;
            }
        }

        if (!rotated) this.shape = oldShape;
    }
}