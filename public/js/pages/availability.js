// availability.js
const cal = document.getElementById('avail-calendar');
const saveA = document.getElementById('save-avail');
let funcs = JSON.parse(localStorage.getItem('funcionarios')||'[]');
let idx = 0; // se precisar, escolha funcionário
let today=new Date(), m=today.getMonth(), y=today.getFullYear();
let blocked = JSON.parse(localStorage.getItem('avail_'+idx)||'[]');

function gen() {
  cal.innerHTML='';
  const first = new Date(y,m,1).getDay();
  const days = new Date(y,m+1,0).getDate();
  for(let i=0;i<first;i++) cal.appendChild(document.createElement('div'));
  for(let d=1;d<=days;d++){
    const cell=document.createElement('div');
    cell.className='day';
    if(blocked.includes(d)) cell.classList.add('holiday');
    cell.textContent=d;
    cell.onclick=()=> {
      if(blocked.includes(d)) blocked=blocked.filter(x=>x!==d);
      else blocked.push(d);
      gen();
    };
    cal.appendChild(cell);
  }
}
saveA.onclick = ()=>{
  localStorage.setItem('avail_'+idx, JSON.stringify(blocked));
  alert('Disponibilidade salva!');
};
gen();
