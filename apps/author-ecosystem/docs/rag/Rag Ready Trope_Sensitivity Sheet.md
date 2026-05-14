Rag Ready Trope/Sensitivity Sheet

## **1.0 CULTURAL STATIC LEDGER (The Social Laws)**

**AI INSTRUCTION:** This section defines the "Hard Rules" of social interaction. Use these to flag dialogue or actions that would be "impossible" or "highly offensive" within a specific culture.  
**1.1 Linguistic Nuance**

* **RAG TAG:** \[Field: Context\_Mode: \[High/Low\]\]  
* **RAG TAG:** \[Field: Directness\_Threshold: \[1-10\]\] (1 \= Never say no directly; 10 \= Brutally honest)

**1.2 Sacred & Profane Symbols**

* **RAG TAG:** \[Field: Taboo\_Colors: \[\]\]  
* **RAG TAG:** \[Field: Taboo\_Actions: \[\]\] (e.g., Showing soles of feet, touching head)

### **1.3 Trope Subversion Map**

AI Instruction: When you see \[Trope\] and it is too similar to known tropes, provide a recommended \[Subversion\] instead.

* **Trope A:** \[e.g., The "Chosen One"\] $\\rightarrow$ **Subversion:** \[It’s actually a committee or a burden of debt.\]  
* **RAG TAG:** \[Field: Trope\_Logic: \[Target\_Trope: \] \[Subversion\_Strategy: \]\]

## **2.0 SENSITIVITY EXPRESSION NODES (The Audit Check)**

*This section handles how characters physically interact across cultures.*

### **2.1 The "Offense" Trigger**

* **RAG TAG:** \[Field: Conflict\_Trigger: \[Action: \] \[Reaction\_Severity: 1-10\]\]  
* **Logic:** If a character performs \[Action\], the AI must reference the **3.0 Ledger** to decrease their \[Current Reputation\].

### **2.2 Non-Verbal Communication**

* **RAG TAG:** \[Field: Body\_Language: \[Gesture: \] \[Contextual\_Meaning: \]\]  
* **Example:** \[Field: Body\_Language: \[Direct Eye Contact: Aggression in Culture B\]\]


## **3.0 NARRATIVE STRUCTURE OVERRIDES (The Style Engine)**

*This section overrides the Western 3-Act structure.*

### **3.1 Structure: Kishōtenketsu (Japanese/East Asian)**

* **RAG TAG:** \[Field: Structure\_Logic: \[Type: Kishōtenketsu\] \[Phase: Intro/Develop/Twist/Reconcile\]\]  
* **Override Logic:** If \[Phase: Twist\], the AI is forbidden from introducing a new external villain; it must introduce a shift in perspective.

### **3.2 Structure: The Circular/Baroque (Spanish/Hispanic)**

* **RAG TAG:** \[Field: Structure\_Logic: \[Type: Circular\] \[Cycle: Prophecy/Echo/Return\]\]  
* **Override Logic:** The resolution must "echo" the first scene of the story to maintain the circular feel.


## **4.0 LINGUISTIC & POETIC FILTERS (The Dialogue Engine)**

*This section dictates how the "Front-End" text is actually written.*

### **4.1 High-Context vs. Low-Context**

* **RAG TAG:** \[Field: Dialogue\_Style: \[Subtext\_Weight: High/Low\] \[Directness: 1-10\]\]

### **4.2 Honorifics & Social Tiering**

* **RAG TAG:** \[Field: Social\_Syntax: \[Honorific\_Suffix: \] \[Hierarchy\_Constraint: \]\]


## **5.0 SENSITIVITY STATE LEDGER (The Live Data)**

*This tracks the "Social Debt" as the story progresses.*

* **RAG TAG:** \[Field: Current\_Reputation: \[Status: \] \[Social\_Capital: %\]\]  
* **RAG TAG:** \[Field: Cultural\_Adaptation: \[Progress: %\]\]

