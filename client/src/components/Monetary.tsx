interface IMonetaryProps {
    value: number;
    showFraction?: boolean;
}

const Monetary: React.FC<IMonetaryProps> = ({ value, showFraction = false }) => {

    const formattedValue = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "ETB",
        maximumFractionDigits: showFraction ? 2 : 0,
    })
        .format(value)
        .replace("DOL", "ETB")

    return (
        <>
            {formattedValue}
        </>
    )
};

export default Monetary;