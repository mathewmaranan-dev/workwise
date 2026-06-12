import random
from datetime import datetime, timedelta, timezone

# Simulate ticket generation to verify SLA/FCR rates
rng = random.Random(42)
sla_hours_options = [1, 4, 24]
made_sla_count = 0
fcr_count = 0
resolved_count = 0
total = 500

now = datetime.now(timezone.utc)

for _ in range(total):
    sla_hours = random.choice(sla_hours_options)
    status_choice = random.choices(['resolved', 'in_progress', 'new', 'pending'], weights=[0.35, 0.40, 0.18, 0.07])[0]
    
    # Only resolved tickets can have made_sla
    if status_choice == 'resolved':
        resolved_count += 1
        
        created_date = now - timedelta(days=rng.randint(1, 180), hours=rng.randint(0, 23), minutes=rng.randint(0, 59))
        sla_duedate = created_date + timedelta(hours=sla_hours)
        
        will_make_sla = rng.random() < 0.80
        if will_make_sla:
            duration = max(0.25, min(sla_hours * rng.uniform(0.10, 0.90), sla_hours * 0.98))
        else:
            duration = sla_hours * rng.uniform(1.05, 2.20)
        
        resolved_date = created_date + timedelta(hours=duration)
        made_sla = bool(resolved_date and resolved_date <= sla_duedate)
        
        if made_sla:
            made_sla_count += 1
        
        # FCR: 85% baseline
        base_fcr_rate = rng.uniform(0.82, 0.92)
        fcr_probability = base_fcr_rate
        if rng.random() < fcr_probability:
            fcr_count += 1

print(f'Total tickets: {total}')
print(f'Resolved tickets: {resolved_count} ({resolved_count/total*100:.1f}%)')
print(f'Made SLA: {made_sla_count} ({made_sla_count/total*100:.1f}% of all, {made_sla_count/resolved_count*100 if resolved_count else 0:.1f}% of resolved)')
print(f'FCR: {fcr_count} ({fcr_count/total*100:.1f}% of all, {fcr_count/resolved_count*100 if resolved_count else 0:.1f}% of resolved)')
