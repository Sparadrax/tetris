/**
 * Pure Tetris rules. The board is 20 rows by 10 columns; active pieces can begin above the visible board. Time values are milliseconds.
 */
export const SHAPES = {
    I: [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]],
    O: [[1,1],[1,1]],
    T: [[0,1,0],[1,1,1],[0,0,0]],
    S: [[0,1,1],[1,1,0],[0,0,0]],
    Z: [[1,1,0],[0,1,1],[0,0,0]],
    J: [[1,0,0],[1,1,1],[0,0,0]],
    L: [[0,0,1],[1,1,1],[0,0,0]],
};
export class Tetris {
    /**
     * function Object() { [native code] }
     *
     * @param random - Random-number source returning a value in [0, 1); used for repeatable tests or randomized generation. Default: Math.random.
     * @returns Initialized instance; constructors do not explicitly return a value.
     */
    constructor(random=Math.random){this.random=random;this.reset();}
    /**
     * Clear board, queue, score, hold state, and timers before spawning the first piece.
     *
     * Inputs: None; uses enclosing state where needed.
     * @returns No value is returned; updates the current state, scene, or interface.
     */
    reset(){
        this.board=Array.from({length:20},()=>Array(10).fill(null));
        this.queue=[];this.score=0;this.lines=0;this.level=1;this.over=false;this.held=null;this.holdUsed=false;
        this.gravityTime=0;this.lockTime=0;this.lockResets=0;this.refill();this.spawn();
    }
    /**
     * Shuffle complete seven-piece bags to keep the upcoming queue stocked.
     *
     * Inputs: None; uses enclosing state where needed.
     * @returns No value is returned; updates the current state, scene, or interface.
     */
    refill(){while(this.queue.length<8){const bag=Object.keys(SHAPES);for(let i=bag.length-1;i>0;i--){const j=Math.floor(this.random()*(i+1));[bag[i],bag[j]]=[bag[j],bag[i]];}this.queue.push(...bag);}}
    /**
     * Create a fresh active piece and detect an immediate top-out.
     *
     * @param type - Piece type to spawn, or the type of block being drawn.
     * @returns No value is returned; updates the current state, scene, or interface.
     */
    spawn(type){
        const kind=type??this.queue.shift();this.refill();
        this.active={type:kind,matrix:SHAPES[kind].map(row=>row.slice()),x:Math.floor((10-SHAPES[kind].length)/2),y:-1};
        this.gravityTime=0;this.lockTime=0;this.lockResets=0;
        if(this.collides(this.active))this.over=true;
    }
    /**
     * Check occupied cells against side walls, floor, and settled blocks; negative rows are allowed.
     *
     * @param piece - Proposed active piece with its shape matrix and board x/y position.
     * @returns True if the proposed piece overlaps occupied cells or a board boundary.
     */
    collides(piece){
        return piece.matrix.some((row,y)=>row.some((cell,x)=>cell&&(piece.x+x<0||piece.x+x>=10||piece.y+y>=20||(piece.y+y>=0&&this.board[piece.y+y][piece.x+x]))));
    }
    /**
     * Test whether moving down one row would collide.
     *
     * Inputs: None; uses enclosing state where needed.
     * @returns True if the active piece would collide when lowered one row.
     */
    grounded(){return this.collides({...this.active,y:this.active.y+1});}
    /**
     * Reset the lock timer after a valid grounded action, up to the reset limit.
     *
     * @param wasGrounded - Whether the piece touched the stack or floor before the successful action.
     * @returns No value is returned; updates the current state, scene, or interface.
     */
    movedWhileGrounded(wasGrounded){if(wasGrounded&&this.lockResets<15){this.lockTime=0;this.lockResets++;}}
    /**
     * Attempt horizontal movement and preserve lock-delay rules.
     *
     * @param dx - Horizontal displacement in board columns.
     * @returns True if horizontal movement succeeded; false if blocked or the game is over.
     */
    move(dx){
        if(this.over)return false;const grounded=this.grounded(),next={...this.active,x:this.active.x+dx};
        if(this.collides(next))return false;this.active=next;this.movedWhileGrounded(grounded);return true;
    }
    /**
     * Rotate the piece matrix and try a short list of positional kicks.
     *
     * @param clockwise - Whether to rotate the piece clockwise instead of counterclockwise. Default: true.
     * @returns True if a rotated position was accepted; false when every kick is blocked.
     */
    rotate(clockwise=true){
        if(this.over)return false;
        const matrix=this.active.matrix,n=matrix.length;
        const rotated=Array.from({length:n},(_,y)=>Array.from({length:n},(_,x)=>clockwise?matrix[n-1-x][y]:matrix[x][n-1-y]));
        const grounded=this.grounded();
        for(const [dx,dy] of [[0,0],[-1,0],[1,0],[-2,0],[2,0],[0,-1],[-1,-1],[1,-1],[0,-2]]){
            const next={...this.active,matrix:rotated,x:this.active.x+dx,y:this.active.y+dy};
            if(!this.collides(next)){this.active=next;this.movedWhileGrounded(grounded);return true;}
        }
        return false;
    }
    /**
     * Move down one row and optionally award soft-drop points.
     *
     * @param soft - Whether this downward move is a soft drop that awards points. Default: false.
     * @returns True if the piece moved down one row; false if blocked or the game is over.
     */
    down(soft=false){
        if(this.over)return false;
        const next={...this.active,y:this.active.y+1};if(this.collides(next))return false;
        this.active=next;this.lockTime=0;if(soft)this.score++;return true;
    }
    /**
     * Find the lowest valid landing position without altering the active piece.
     *
     * Inputs: None; uses enclosing state where needed.
     * @returns Copy of the active piece at its lowest noncolliding position.
     */
    ghost(){let piece={...this.active};while(!this.collides({...piece,y:piece.y+1}))piece={...piece,y:piece.y+1};return piece;}
    /**
     * Move directly to the ghost position, award drop points, and lock.
     *
     * Inputs: None; uses enclosing state where needed.
     * @returns No value is returned; updates the current state, scene, or interface.
     */
    hardDrop(){if(this.over)return;const ghost=this.ghost();this.score+=(ghost.y-this.active.y)*2;this.active=ghost;this.lock();}
    /**
     * Swap with the held piece at most once per piece placement.
     *
     * Inputs: None; uses enclosing state where needed.
     * @returns True if the hold swap was performed, otherwise false.
     */
    hold(){if(this.over||this.holdUsed)return false;const type=this.active.type,held=this.held;this.held=type;this.spawn(held??undefined);this.holdUsed=true;return true;}
    /**
     * Merge the active piece into the board, clear completed rows, score, and spawn the next piece.
     *
     * Inputs: None; uses enclosing state where needed.
     * @returns No value is returned; updates the current state, scene, or interface.
     */
    lock(){
        if(this.over)return;
        const piece=this.active;
        for(let y=0;y<piece.matrix.length;y++)for(let x=0;x<piece.matrix.length;x++)if(piece.matrix[y][x]&&piece.y+y<0){this.over=true;return;}
        piece.matrix.forEach((row,y)=>row.forEach((cell,x)=>{if(cell)this.board[piece.y+y][piece.x+x]=piece.type;}));
        const remaining=this.board.filter(row=>row.some(cell=>!cell));const cleared=20-remaining.length;
        this.board=[...Array.from({length:cleared},()=>Array(10).fill(null)),...remaining];
        this.score += [0,100,300,500,800][cleared]*this.level;this.lines+=cleared;this.level=1+Math.floor(this.lines/10);
        this.holdUsed=false;this.spawn();
    }
    /**
     * Advance gravity and grounded lock delay using elapsed milliseconds.
     *
     * @param milliseconds - Elapsed simulation time in milliseconds.
     * @returns No value is returned; updates the current state, scene, or interface.
     */
    tick(milliseconds){
        if(this.over)return;
        this.gravityTime+=milliseconds;const interval=Math.max(60,850*Math.pow(.8,this.level-1));
        while(this.gravityTime>=interval){this.gravityTime-=interval;if(!this.down())break;}
        if(this.grounded()){this.lockTime+=milliseconds;if(this.lockTime>=500)this.lock();}else this.lockTime=0;
    }
}
