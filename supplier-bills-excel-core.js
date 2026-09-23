import ExcelJS from 'exceljs';
import { excelAttachmentLink } from './attachment-links.js';

const asDate=v=>{if(!v)return null;const d=new Date(v);return Number.isNaN(d.getTime())?null:d};
const text=v=>v===undefined||v===null?'':String(v);

export async function generateSupplierBillsExcel(sql,{from=null,to=null}={}){
  const rows=await sql`
    SELECT i.*,s.business_name
    FROM supplier_invoices i
    JOIN suppliers s ON s.id=i.supplier_id
    WHERE (${from}::date IS NULL OR i.invoice_date>=${from}::date)
      AND (${to}::date IS NULL OR i.invoice_date<=${to}::date)
    ORDER BY i.invoice_date DESC,i.id DESC
  `;

  const wb=new ExcelJS.Workbook();
  wb.creator='Kashif Traders ERP';
  wb.company='Kashif Traders';
  wb.created=new Date();
  const ws=wb.addWorksheet('Supplier Bills',{views:[{state:'frozen',ySplit:4}]});

  ws.mergeCells('A1:P1');
  ws.getCell('A1').value='KASHIF TRADERS — SUPPLIER BILLS';
  ws.getCell('A1').font={bold:true,size:16,color:{argb:'FFFFFFFF'}};
  ws.getCell('A1').fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF173F35'}};
  ws.getCell('A1').alignment={vertical:'middle',horizontal:'left'};
  ws.getRow(1).height=28;
  ws.mergeCells('A2:P2');
  ws.getCell('A2').value=`Final ERP records${from||to?` | Date range: ${from||'Beginning'} to ${to||'Latest'}`:''}`;
  ws.getCell('A2').font={italic:true,color:{argb:'FF666666'}};

  const headers=['ERP Entry No.','Database Record ID','Supplier','Supplier Invoice No.','Invoice Date','Due Date','Bill Amount','Payment Status','Notes','Bill Image','Created By Name','Created By Designation','Created At','Updated By Name','Updated By Designation','Updated At'];
  ws.getRow(4).values=headers;
  ws.getRow(4).font={bold:true,color:{argb:'FFFFFFFF'}};
  ws.getRow(4).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF2F6657'}};
  ws.getRow(4).alignment={vertical:'middle',horizontal:'center',wrapText:true};
  ws.getRow(4).height=30;
  ws.autoFilter={from:'A4',to:'P4'};

  let totalAmount=0;
  for(const r of rows){
    const amount=Number(r.amount||0);totalAmount+=Number.isFinite(amount)?amount:0;
    const row=ws.addRow([
      text(r.entry_number)||text(r.invoice_number),r.id,text(r.business_name),text(r.invoice_number),asDate(r.invoice_date),asDate(r.due_date),amount,text(r.status)||'unpaid',text(r.notes),'',text(r.created_by_name),text(r.created_by_designation),asDate(r.created_at),text(r.updated_by_name),text(r.updated_by_designation),asDate(r.updated_at)
    ]);
    row.alignment={vertical:'top'};
    row.getCell(5).numFmt='dd-mmm-yyyy';
    row.getCell(6).numFmt='dd-mmm-yyyy';
    row.getCell(7).numFmt='#,##0.00';
    row.getCell(9).alignment={vertical:'top',wrapText:true};
    row.getCell(13).numFmt='dd-mmm-yyyy hh:mm';
    row.getCell(16).numFmt='dd-mmm-yyyy hh:mm';
    const href=excelAttachmentLink('supplier_invoices',r.id,r.attachment_url);
    if(href){row.getCell(10).value={text:'View Image',hyperlink:href};row.getCell(10).font={color:{argb:'FF0563C1'},underline:true};}
  }

  const totalRow=ws.addRow([]);
  totalRow.getCell(6).value='TOTAL BILL AMOUNT';
  totalRow.getCell(6).font={bold:true};
  totalRow.getCell(7).value=totalAmount;
  totalRow.getCell(7).numFmt='#,##0.00';
  totalRow.getCell(7).font={bold:true};
  totalRow.getCell(6).fill=totalRow.getCell(7).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFF3E6B3'}};

  ws.columns=[18,18,30,22,16,16,18,16,34,18,24,22,21,24,22,21].map(width=>({width}));
  ws.eachRow((row,n)=>{if(n>=5)row.eachCell(cell=>{cell.border={bottom:{style:'hair',color:{argb:'FFD9D9D9'}}};});});

  const buffer=Buffer.from(await wb.xlsx.writeBuffer());
  const stamp=new Date().toISOString().slice(0,10);
  return{buffer,filename:`Kashif-Traders-Supplier-Bills-${stamp}.xlsx`,count:rows.length};
}
