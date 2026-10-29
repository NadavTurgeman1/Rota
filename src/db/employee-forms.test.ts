import { describe, expect, it } from "vitest";
import { addEmployeeForm, deleteEmployeeForm, listEmployeeForms, readEmployeeForm } from "./employee-forms";
import { SaveError } from "./save";
import { asRole, client, openTestDatabase } from "./test-db";

const owner = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const worker = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const sentinel = "11111111-1111-4111-8111-111111111111";
const headquarters = "22222222-2222-4222-8222-222222222222";

describe("employee forms", () => {
  it("lets a manager keep a form, and keeps it away from an employee", async () => {
    const db = await openTestDatabase();
    const sql = client(db);
    const people = await sql.query<{ id: string }>(
      `select e.id from public.employees e join public.employee_sites es on es.employee_id = e.id where es.site_id = $1 limit 1`,
      [headquarters],
    );
    const employeeId = people[0]?.id;
    if (!employeeId) throw new Error("seed");
    await db.exec(
      `insert into auth.users (id, email) values ('${owner}', 'owner.forms@example.com'), ('${worker}', 'worker.forms@example.com');
       insert into public.memberships (org_id, user_id, role) values
         ('${sentinel}', '${owner}', 'owner'),
         ('${sentinel}', '${worker}', 'employee');`,
    );
    const body = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]);

    await asRole(db, "authenticated", owner);
    const saved = await addEmployeeForm(sql, { employeeId, name: "חוזה.pdf", type: "application/pdf", body });
    expect(saved.name).toBe("חוזה.pdf");
    expect(saved.bytes).toBe(body.byteLength);
    const listed = await listEmployeeForms(sql, employeeId);
    expect(listed.map((form) => form.id)).toEqual([saved.id]);
    const opened = await readEmployeeForm(sql, saved.id);
    expect([...opened.body]).toEqual([...body]);

    await asRole(db, "authenticated", worker);
    await expect(listEmployeeForms(sql, employeeId)).resolves.toEqual([]);
    await expect(addEmployeeForm(sql, { employeeId, name: "other.pdf", type: "application/pdf", body })).rejects.toThrow(SaveError);
    await expect(readEmployeeForm(sql, saved.id)).rejects.toThrow(/forbidden/);

    await asRole(db, "authenticated", owner);
    await deleteEmployeeForm(sql, saved.id);
    await expect(listEmployeeForms(sql, employeeId)).resolves.toEqual([]);
    await expect(addEmployeeForm(sql, { employeeId, name: "notes.exe", type: "application/octet-stream", body })).rejects.toThrow(/type/);
  });
});
