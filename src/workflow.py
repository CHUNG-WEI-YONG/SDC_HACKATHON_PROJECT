from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.memory import MemorySaver
from .schema import AgentState
from .agents import create_extraction_node, verification_node, store_node

def approval_router(state: AgentState):
    if state.get("manager_approval") is False:
        return END
    return "store"

def invoice_source_router(state: AgentState):
    return "verify" if state.get("invoice_data") else "extract"

def build_workflow(llm):
    builder = StateGraph(AgentState)

    builder.add_node("extract", create_extraction_node(llm))
    builder.add_node("verify", verification_node)
    builder.add_node("store", store_node)

    builder.add_node("source", lambda state: state)
    builder.add_edge(START, "source")
    builder.add_conditional_edges(
        "source",
        invoice_source_router,
        {"extract": "extract", "verify": "verify"}
    )
    builder.add_edge("extract", "verify")
    builder.add_conditional_edges(
        "verify",
        approval_router,
        {"store": "store", END: END}
    )
    builder.add_edge("store", END)

    memory = MemorySaver()
    return builder.compile(
        checkpointer=memory,
        interrupt_before=["store"]
    )
