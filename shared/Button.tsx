import React from "react";
import Link from "next/link";

const Button = (props: any) => {

    return (
        <div style={{border: "1px solid grey", textAlign: 'center', backgroundColor: "#e6e6e6"}}>
            <Link href={props.path}>Click to go to {props.path}</Link>
        </div>
    )
}

export default Button;
