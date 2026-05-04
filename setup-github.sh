#!/bin/bash

# GitHub Repository Setup Script
# Run this to initialize your GitHub repository

echo "🚀 Setting up GitHub repository for Work-Wise ITSM System"
echo ""

# Check if git is initialized
if [ ! -d ".git" ]; then
    echo "📋 Initializing git repository..."
    git init
else
    echo "✅ Git repository already initialized"
fi

# Check if remote origin exists
if git remote get-url origin > /dev/null 2>&1; then
    echo "✅ GitHub remote already configured"
else
    echo "❓ Please enter your GitHub repository URL:"
    echo "   Example: https://github.com/yourusername/work-wise-itsm.git"
    read -p "Repository URL: " repo_url

    if [ -n "$repo_url" ]; then
        git remote add origin "$repo_url"
        echo "✅ Added remote origin: $repo_url"
    else
        echo "❌ No URL provided. Please add remote manually:"
        echo "   git remote add origin https://github.com/yourusername/work-wise-itsm.git"
        exit 1
    fi
fi

# Add all files
echo "📁 Adding files to git..."
git add .

# Create initial commit
echo "💾 Creating initial commit..."
git commit -m "Initial commit: Work-Wise ITSM system with ML forecasting

Features:
- React + TypeScript frontend with dashboard
- Node.js + Express backend with PostgreSQL
- Python ML service for forecasting and optimization
- Complete ITSM schema with 18 tables
- Docker containerization for local development
- Render deployment ready

Business Logic:
- SLA management (24hrs high, 2 days medium, 4 days low)
- FCR calculation with reopen/reassignment tracking
- Priority-based routing and assignment
- Survey integration for customer feedback"

# Push to GitHub
echo "⬆️ Pushing to GitHub..."
if git push -u origin main 2>/dev/null; then
    echo "✅ Successfully pushed to GitHub!"
else
    echo "⚠️ Push failed. This might be normal for new repositories."
    echo "   Try: git push -u origin main"
fi

echo ""
echo "🎉 GitHub setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Go to your GitHub repository"
echo "2. Add a README.md if not present"
echo "3. Consider adding:"
echo "   - MIT License"
echo "   - Issues templates"
echo "   - Pull request template"
echo ""
echo "🔗 Repository URL: $(git remote get-url origin 2>/dev/null || echo 'Not set')"