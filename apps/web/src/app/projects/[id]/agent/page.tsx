import { updateAgentAction } from "@/lib/actions";
import { readProject } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function AgentGeneralPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await readProject(id);

  return (
    <form action={updateAgentAction} className="panel" style={{ maxWidth: 600 }}>
      <div className="modal-body">
      <input type="hidden" name="id" value={id} />

      <div className="field">
        <label className="label" htmlFor="name">
          Name
        </label>
        <input
          className="input"
          id="name"
          name="name"
          defaultValue={project.agent.name}
          required
          maxLength={80}
        />
      </div>

      <div className="field">
        <label className="label" htmlFor="description">
          Description
        </label>
        <input
          className="input"
          id="description"
          name="description"
          defaultValue={project.agent.description ?? ""}
          maxLength={280}
        />
      </div>

      </div>
      <div className="modal-foot">
        <button className="button" data-variant="primary" type="submit">
          Save
        </button>
      </div>
    </form>
  );
}
