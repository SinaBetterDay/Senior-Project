# Senior-Project
Full-stack compliance platform built for the California Fair Political Practices Commission to detect conflicts of interest in legislative activity. It cross-references motions, voting records, and financial disclosures to flag potential cases where officials may benefit financially from proposed policies.
# Naming Convention for Branches
dev branch where intergration occur before committing into the main.
features branch add feature to the product.
# Testing
# Deployment
# 1. Clone the repository
git clone https://github.com/software-hornets/fair.git
cd fair

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env.local
# Fill in your Supabase URL, anon key, and Anthropic API key

# 4. Push the database schema
npx prisma db push

# 5. Run the development server
npm run dev
# Developer Instruction
# JIRA Timeline
# Prototype 
# ERD Diagram
